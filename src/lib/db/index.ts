import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const dataDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const dbPath = path.join(dataDir, 'prompt-manager.db')
  db = new Database(dbPath)

  // Enable WAL mode and foreign keys
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run schema
  const schemaPath = path.join(__dirname, 'schema.sql')
  let schema: string
  // In Next.js, __dirname may not work for .sql files, so read relative to cwd
  const altPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql')
  if (fs.existsSync(schemaPath)) {
    schema = fs.readFileSync(schemaPath, 'utf-8')
  } else if (fs.existsSync(altPath)) {
    schema = fs.readFileSync(altPath, 'utf-8')
  } else {
    throw new Error('Cannot find schema.sql')
  }

  db.exec(schema)

  return db
}
