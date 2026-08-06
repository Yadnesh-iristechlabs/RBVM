import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import assetsRouter from './routes/assets'
import importRouter from './routes/import'
import qualysRouter from './routes/qualys'
import exceptionsRouter from './routes/exceptions'
import integrationsRouter from './routes/integrations'
import snapshotsRouter from './routes/snapshots'
import workflowRouter from './routes/workflow'
import mastersRouter from './routes/masters'
import usersRouter from './routes/users'
import applicationsRouter from './routes/applications'
import componentsRouter from './routes/components'
import connectorsRouter from './routes/connectors'
import assessmentRequestsRouter from './routes/assessmentRequests'
import assessmentsRouter from './routes/assessments'
import masterVulnerabilitiesRouter from './routes/masterVulnerabilities'
import autoScanRouter from './routes/autoScan'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/assets', assetsRouter)
app.use('/api/import', importRouter)
app.use('/api/qualys', qualysRouter)
app.use('/api/exceptions', exceptionsRouter)
app.use('/api/integrations', integrationsRouter)
app.use('/api/snapshots', snapshotsRouter)
app.use('/api/workflow', workflowRouter)
app.use('/api/masters', mastersRouter)
app.use('/api/users', usersRouter)
app.use('/api/applications', applicationsRouter)
app.use('/api/components', componentsRouter)
app.use('/api/connectors', connectorsRouter)
app.use('/api/assessment-requests', assessmentRequestsRouter)
app.use('/api/assessments', assessmentsRouter)
app.use('/api/vulnerabilities', masterVulnerabilitiesRouter)
app.use('/api/auto-scan', autoScanRouter)

const port = process.env.PORT || 4001
app.listen(port, () => {
  console.log(`server running on port ${port}`)
})