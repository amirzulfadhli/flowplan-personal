use crate::{database::StoreError, model::Workspace, DatabasePath};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::Duration,
};
use tauri::{Manager, State};
use tokio::sync::watch;

#[derive(Default)]
pub struct AiRuntime {
    requests: Mutex<HashMap<String, watch::Sender<bool>>>,
    next: AtomicU64,
}
fn error(message: impl Into<String>) -> StoreError {
    StoreError::new("AI", message)
}
fn absent(value: &Value) -> bool {
    value.is_null() || value.as_str() == Some("")
}

pub fn endpoint(value: &str) -> Result<String, StoreError> {
    let value = value.trim();
    // Validate the literal authority before URL parsing: no DNS, alternate numeric IPs,
    // credentials, URL paths, query strings, fragments, or non-loopback destinations.
    let authority = value
        .strip_prefix("http://")
        .ok_or_else(|| error("Use a local http://127.0.0.1:11434 Ollama address."))?
        .trim_end_matches('/');
    let rest = if let Some(rest) = authority.strip_prefix("127.0.0.1") {
        rest
    } else if let Some(rest) = authority.strip_prefix("localhost") {
        rest
    } else if let Some(rest) = authority.strip_prefix("[::1]") {
        rest
    } else {
        return Err(error("Only loopback Ollama connections are allowed."));
    };
    if !rest.is_empty() {
        let port = rest
            .strip_prefix(':')
            .ok_or_else(|| error("Paths and credentials are not allowed."))?;
        if port.is_empty()
            || !port.bytes().all(|b| b.is_ascii_digit())
            || port.parse::<u16>().ok().filter(|p| *p > 0).is_none()
        {
            return Err(error("Choose a port from 1 to 65535."));
        }
    }
    let url = reqwest::Url::parse(&value.replace("localhost", "127.0.0.1"))
        .map_err(|_| error("Invalid local Ollama address."))?;
    if url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(error("Paths and credentials are not allowed."));
    }
    Ok(url.origin().ascii_serialization())
}
pub fn context(data: &Workspace, project_id: &str) -> Result<Value, StoreError> {
    let project = data
        .projects
        .iter()
        .find(|p| p.id == project_id)
        .ok_or_else(|| error("This project no longer exists."))?;
    let tasks: Vec<_> = data
        .tasks
        .iter()
        .filter(|t| t.project_id == project_id)
        .collect();
    let activity: Vec<_> = data
        .activity
        .iter()
        .filter(|a| a.project_id == project_id)
        .collect();
    let context = json!({
        "project": { "id": project.id, "name": project.name, "description": project.description, "due": project.due, "notes": project.notes },
        "progress": { "total": tasks.len(), "done": tasks.iter().filter(|t| t.status == "done").count() },
        "tasks": tasks.iter().map(|t| json!({ "id": t.id, "title": t.title, "description": t.description, "status": t.status, "priority": t.priority, "due": t.due, "completedAt": t.completed_at })).collect::<Vec<_>>(),
        "activity": activity.iter().take(30).map(|a| json!({ "message": a.message, "time": a.time })).collect::<Vec<_>>(),
        "omittedActivity": activity.len().saturating_sub(30)
    });
    if serde_json::to_vec(&context)?.len() > 60_000 {
        return Err(error(
            "This project exceeds the 60 KB AI context limit. Shorten notes or task descriptions.",
        ));
    }
    Ok(context)
}
pub fn local_models(value: &Value) -> Result<Vec<String>, StoreError> {
    let models = value["models"]
        .as_array()
        .ok_or_else(|| error("Ollama returned an invalid model list."))?;
    Ok(models
        .iter()
        .filter(|m| {
            m["name"].as_str().is_some_and(|s| {
                !s.is_empty() && s.len() <= 200 && !s.to_ascii_lowercase().contains("cloud")
            }) && absent(&m["remote_host"])
                && absent(&m["remote_model"])
                && m["size"].as_u64().unwrap_or(0) > 0
                && m["digest"].as_str().is_some_and(|s| !s.is_empty())
                && m["details"]["format"] == "gguf"
        })
        .filter_map(|m| m["name"].as_str().map(String::from))
        .collect())
}
async fn json_request(
    client: &reqwest::Client,
    base: &str,
    path: &str,
    body: Option<Value>,
) -> Result<Value, StoreError> {
    let url = format!("{base}/api/{path}");
    let mut request = if let Some(body) = body {
        client.post(url).json(&body)
    } else {
        client.get(url)
    };
    if path != "chat" {
        request = request.timeout(Duration::from_secs(15));
    }
    let mut response = request.send().await.map_err(|_| {
        error(
            "Could not reach local Ollama. Start Ollama, check the address and model, then retry.",
        )
    })?;
    if !response.status().is_success() {
        return Err(error(format!(
            "Ollama returned HTTP {}. Check the local server and selected model.",
            response.status().as_u16()
        )));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| error("The Ollama response was interrupted. No tasks changed."))?
    {
        if bytes.len() + chunk.len() > 1_000_000 {
            return Err(error("Ollama response exceeds the 1 MB safety limit."));
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes)
        .map_err(|_| error("Ollama returned invalid JSON. No tasks changed."))
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    endpoint: String,
    operation: String,
    project_id: Option<String>,
    expected_revision: Option<u64>,
    model: Option<String>,
    intent: Option<String>,
    question: Option<String>,
}
async fn run(app: &tauri::AppHandle, request: Request) -> Result<Value, StoreError> {
    let base = endpoint(&request.endpoint)?;
    let client = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|_| error("Could not initialize the local AI connection."))?;
    if request.operation == "models" {
        return Ok(json!(local_models(
            &json_request(&client, &base, "tags", None).await?
        )?));
    }
    if request.operation != "generate" {
        return Err(error("Unknown AI operation."));
    }
    let model = request
        .model
        .filter(|m| !m.is_empty() && m.len() <= 200)
        .ok_or_else(|| error("Choose a local model."))?;
    let intent = request
        .intent
        .filter(|s| ["Summary", "Priorities", "Blockers", "Task breakdown"].contains(&s.as_str()))
        .ok_or_else(|| error("Choose a supported assistance type."))?;
    let question = request.question.unwrap_or_default();
    if question.encode_utf16().count() > 2000 {
        return Err(error("Keep the question below 2,000 characters."));
    }
    let project_context = {
        let data = app.state::<DatabasePath>().open()?.read()?;
        if request.expected_revision != Some(data.revision) {
            return Err(error(
                "The workspace changed. Review the current context and retry.",
            ));
        }
        context(
            &data,
            request
                .project_id
                .as_deref()
                .ok_or_else(|| error("Select a project."))?,
        )?
    };
    let models = local_models(&json_request(&client, &base, "tags", None).await?)?;
    if !models.contains(&model) {
        return Err(error("This local model is no longer available. Refresh models; cloud models are not allowed."));
    }
    let details = json_request(&client, &base, "show", Some(json!({"model": model}))).await?;
    if !absent(&details["remote_host"])
        || !absent(&details["remote_model"])
        || !details["model_info"].is_object()
        || !details["capabilities"]
            .as_array()
            .is_some_and(|a| a.contains(&json!("completion")))
    {
        return Err(error(
            "This model cannot be verified as a local text model. Choose another model.",
        ));
    }
    let prompt: Value = serde_json::from_str(include_str!("../../src/ai/prompt.json"))?;
    let result = json_request(&client, &base, "chat", Some(json!({
        "model": model, "stream": false, "think": false, "keep_alive": "1m", "format": prompt["format"],
        "options": { "temperature": 0.2, "num_predict": 3000, "num_ctx": 16384 },
        "messages": [{ "role": "system", "content": prompt["system"] }, { "role": "user", "content": json!({ "intent": intent, "question": question, "context": project_context }).to_string() }]
    }))).await?;
    if result["done"] != true
        || result["done_reason"] == "length"
        || result["message"]["tool_calls"]
            .as_array()
            .is_some_and(|a| !a.is_empty())
    {
        return Err(error(
            "Ollama returned an incomplete or unsupported response. Try a smaller request.",
        ));
    }
    let content = result["message"]["content"]
        .as_str()
        .filter(|s| s.len() <= 64_000)
        .ok_or_else(|| error("Ollama returned an invalid or oversized answer."))?;
    Ok(json!(content))
}
#[tauri::command]
pub fn ai_begin(state: State<'_, AiRuntime>) -> Result<String, StoreError> {
    let mut requests = state
        .requests
        .lock()
        .map_err(|_| error("AI request state unavailable."))?;
    if requests.len() >= 4 {
        return Err(error(
            "Cancel the current AI request before starting another.",
        ));
    }
    let id = state.next.fetch_add(1, Ordering::Relaxed).to_string();
    let (sender, _) = watch::channel(false);
    requests.insert(id.clone(), sender);
    Ok(id)
}
#[tauri::command]
pub fn ai_cancel(state: State<'_, AiRuntime>, id: String) {
    if let Ok(mut requests) = state.requests.lock() {
        if let Some(sender) = requests.remove(&id) {
            sender.send_replace(true);
        }
    }
}
#[tauri::command]
pub async fn ai_request(
    app: tauri::AppHandle,
    id: String,
    request: Request,
) -> Result<Value, StoreError> {
    let mut cancel = app
        .state::<AiRuntime>()
        .requests
        .lock()
        .map_err(|_| error("AI request state unavailable."))?
        .get(&id)
        .ok_or_else(|| error("Request cancelled."))?
        .subscribe();
    let result = tokio::select! {
        _ = cancel.changed() => Err(error("Request cancelled. No tasks changed.")),
        result = tokio::time::timeout(Duration::from_secs(180), run(&app, request)) => result.unwrap_or_else(|_| Err(error("Local Ollama timed out. No tasks changed.")))
    };
    ai_cancel(app.state::<AiRuntime>(), id);
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_remote_credentials_paths_and_ambiguous_addresses() {
        for value in [
            "https://ollama.com",
            "http://192.168.1.1:11434",
            "http://127.0.0.1.evil.com",
            "http://user@127.0.0.1",
            "http://2130706433",
            "http://127.1",
            "http://localhost/api",
            "http://localhost?x=1",
            "http://localhost:0",
            "http://localhost:65536",
        ] {
            assert!(endpoint(value).is_err(), "{value}");
        }
        assert_eq!(
            endpoint("http://localhost:11434").unwrap(),
            "http://127.0.0.1:11434"
        );
        assert_eq!(
            endpoint("http://[::1]:11434/").unwrap(),
            "http://[::1]:11434"
        );
    }
    #[test]
    fn rejects_cloud_aliases_and_unverifiable_models() {
        let local = json!({ "name": "local:latest", "size": 100, "digest": "abc", "details": { "format": "gguf" } });
        let mut remote = local.clone();
        remote["name"] = json!("alias");
        remote["remote_host"] = json!("https://ollama.com");
        let mut cloud = local.clone();
        cloud["name"] = json!("model:cloud");
        assert_eq!(
            local_models(&json!({"models": [local, remote, cloud, {"name":"unknown"}]})).unwrap(),
            vec!["local:latest"]
        );
    }
    #[test]
    fn project_context_excludes_profile_and_other_projects() {
        let mut data = Workspace::default();
        data.profile.name = "SECRET PROFILE".into();
        let project = crate::model::Project {
            id: "alpha".into(),
            name: "Alpha".into(),
            description: "".into(),
            color: "#7d87ec".into(),
            due: "".into(),
            notes: "local notes".into(),
            created_at: "".into(),
            updated_at: "".into(),
        };
        data.projects.push(project.clone());
        data.projects.push(crate::model::Project {
            id: "beta".into(),
            notes: "SECRET BETA".into(),
            ..project
        });
        data.activity.push(crate::model::Activity {
            id: "a".into(),
            project_id: "beta".into(),
            message: "SECRET ACTIVITY".into(),
            time: "".into(),
        });
        let value = context(&data, "alpha").unwrap().to_string();
        assert!(value.contains("local notes"));
        assert!(!value.contains("SECRET"));
        assert!(context(&data, "missing").is_err());
        data.projects[0].notes = "x".repeat(60_000);
        assert!(context(&data, "alpha").is_err());
    }
}
