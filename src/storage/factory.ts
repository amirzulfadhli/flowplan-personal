import { isDesktop, SQLiteRepository } from './desktop'
import { IndexedDBRepository, type WorkspaceRepository } from './repository'

export function createRepository(): WorkspaceRepository {
  // Never fall back to an empty browser database when native persistence fails.
  return isDesktop() ? new SQLiteRepository() : new IndexedDBRepository()
}
