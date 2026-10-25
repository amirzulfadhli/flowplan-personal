import { applyCommand } from '../domain/commands'
import { emptyWorkspace, type Workspace } from '../domain/model'

export function fixture(): Workspace {
  let data = applyCommand(
    emptyWorkspace(),
    {
      type: 'saveProject',
      input: { name: 'Alpha', description: 'First project', color: '#7d87ec', due: '' },
    },
    '2026-01-01T12:00:00.000Z',
  )
  data = applyCommand(
    data,
    {
      type: 'saveProject',
      input: { name: 'Beta', description: 'Second project', color: '#6dc3a4', due: '' },
    },
    '2026-01-01T12:00:00.000Z',
  )
  return applyCommand(
    data,
    {
      type: 'saveTask',
      input: {
        projectId: data.projects[0].id,
        title: 'Build the thing',
        description: '',
        due: '2026-01-03',
        priority: 'High',
        status: 'todo',
      },
    },
    '2026-01-01T12:00:00.000Z',
  )
}
