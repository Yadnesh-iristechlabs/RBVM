import fs from 'fs'
import path from 'path'
import { pool } from './pool'

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')
  await pool.query(sql)
  console.log('migration complete')
  await pool.end()
}

migrate().catch((err) => {
  console.error('migration failed:', err)
  process.exit(1)
})