import { chromium } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const scratch = process.env.SCRATCH || '/tmp/grok-goal-606eec3ed65d/implementer'
const PORT = 5181

function killPort(port) {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null || true`, { stdio: 'ignore' })
  } catch {
    /* ignore */
  }
}

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return true
    } catch {
      /* retry */
    }
    await sleep(300)
  }
  return false
}

async function dragPerimeter(page, nodeTestId, angleDeg = 0) {
  const svg = await page.$('svg[data-testid="node-graph"]')
  const node = await page.$(`[data-testid="node-${nodeTestId}"]`)
  if (!svg || !node) return false
  const svgBox = await svg.boundingBox()
  if (!svgBox) return false

  const point = await page.$eval(
    `[data-testid="node-${nodeTestId}"]`,
    (el, angle) => {
      const x = parseFloat(el.getAttribute('data-x') || '0')
      const y = parseFloat(el.getAttribute('data-y') || '0')
      const rad = (angle * Math.PI) / 180
      const ring = 24
      return {
        x: x + Math.cos(rad) * ring,
        y: y - Math.sin(rad) * ring,
      }
    },
    angleDeg,
  )

  const toScreen = (p) => ({
    x: svgBox.x + (p.x / 800) * svgBox.width,
    y: svgBox.y + (p.y / 600) * svgBox.height,
  })

  const start = toScreen(point)
  const end = toScreen({
    x: point.x + Math.cos((angleDeg * Math.PI) / 180) * 120,
    y: point.y - Math.sin((angleDeg * Math.PI) / 180) * 120,
  })

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  const hadPreview = !!(await page.$('[data-testid="placement-preview"]'))
  await page.mouse.move(end.x, end.y)
  await page.mouse.up()
  await page.waitForTimeout(300)
  return { cx: start.x, cy: start.y, hadPreview }
}

function radialDistance(parent, child, angle) {
  const dx = child.x - parent.x
  const dy = child.y - parent.y
  return Math.max(0, dx * Math.cos(angle) - dy * Math.sin(angle))
}

function readNodes(page) {
  return page.$$eval('.node', (els) =>
    els.map((el) => ({
      id: el.getAttribute('data-testid'),
      x: parseFloat(el.getAttribute('data-x') || '0'),
      y: parseFloat(el.getAttribute('data-y') || '0'),
      distance: parseFloat(el.getAttribute('data-distance') || '0'),
      angle: parseFloat(el.getAttribute('data-wedge-angle') || '0'),
      kind: el.getAttribute('data-node-kind'),
      selected: el.getAttribute('data-selected') === 'true',
    })),
  )
}

function checkInsertChildDistance(nodes) {
  const insert = nodes.find((n) => n.kind === 'edge-insert')
  const child = nodes.find((n) => n.kind === 'standard' && n.distance > 0 && insert)
  if (!insert || !child) return { ok: false, insertDistance: null, childDistance: null, radial: null }
  const radial = radialDistance(insert, child, child.angle)
  return {
    ok: Math.abs(child.distance - radial) < 1,
    insertDistance: insert.distance,
    childDistance: child.distance,
    radial,
  }
}

async function runOnce(runId) {
  const transcript = { runId, ok: false, error: null }
  let preview = null

  try {
    killPort(PORT)
    await sleep(800)

    preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1', '--strictPort'], {
      cwd: root,
      stdio: 'pipe',
    })

    const ready = await waitForServer(`http://127.0.0.1:${PORT}/`)
    if (!ready) throw new Error('preview server not ready')

    let browser = null
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } })

    try {
      await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForSelector('[data-testid="create-root"]', { timeout: 10000 })

      const errs = await page.evaluate(() => window.__errors || [])
      const svg = await page.$('svg[data-testid="node-graph"]')
      const box = svg ? await svg.boundingBox() : null

      const nodesBefore = await readNodes(page)
      if (nodesBefore.length !== 0) throw new Error(`nodesBefore expected 0, got ${nodesBefore.length}`)

      await page.click('[data-testid="create-root"]')
      await page.waitForTimeout(300)
      await page.screenshot({ path: path.join(scratch, `step-root-${runId}.png`), fullPage: true })

      const nodesAfterRoot = await readNodes(page)
      if (nodesAfterRoot.length !== 1) throw new Error(`nodesAfterRoot expected 1, got ${nodesAfterRoot.length}`)
      const rootId = nodesAfterRoot[0].id?.replace('node-', '')

      const drag1 = await dragPerimeter(page, rootId, 0)
      if (!drag1) throw new Error('first perimeter drag failed')
      await page.screenshot({ path: path.join(scratch, `step-child1-${runId}.png`), fullPage: true })
      const nodesAfterPlace1 = await readNodes(page)
      if (nodesAfterPlace1.length < 2) throw new Error(`nodesAfterPlace1 expected >=2, got ${nodesAfterPlace1.length}`)

      const drag2 = await dragPerimeter(page, rootId, 90)
      if (!drag2) throw new Error('second perimeter drag failed')
      await page.screenshot({ path: path.join(scratch, `step-child2-${runId}.png`), fullPage: true })
      const nodesAfterPlace2 = await readNodes(page)
      if (nodesAfterPlace2.length < 3) throw new Error(`nodesAfterPlace2 expected >=3, got ${nodesAfterPlace2.length}`)

      const child = nodesAfterPlace2.find((n) => n.distance > 0 && n.kind === 'standard')
      const distBefore = child?.distance ?? 0
      const angleBefore = child?.angle ?? 0

      if (child?.id) {
        const nodeId = child.id.replace('node-', '')
        const rootBody = await page.$(`[data-testid="node-select-core-${rootId}"]`)
        const dragCore = await page.$(`[data-testid="node-select-core-${nodeId}"]`)
        if (dragCore && rootBody) {
          const rb = await rootBody.boundingBox()
          const db = await dragCore.boundingBox()
          if (rb && db) {
            const rcx = rb.x + rb.width / 2
            const rcy = rb.y + rb.height / 2
            const ccx = db.x + db.width / 2
            const ccy = db.y + db.height / 2
            const dx = ccx - rcx
            const dy = ccy - rcy
            await page.mouse.move(ccx, ccy)
            await page.mouse.down()
            await page.mouse.move(ccx + dx * 0.6, ccy + dy * 0.6)
            await page.mouse.up()
            await page.waitForTimeout(300)
          }
        }
      }

      await page.screenshot({ path: path.join(scratch, `step-reposition-${runId}.png`), fullPage: true })
      const nodesAfterReposition = await readNodes(page)
      const childAfter = nodesAfterReposition.find((n) => n.distance > 0 && n.kind === 'standard')
      const distAfter = childAfter?.distance ?? 0
      const angleAfter = childAfter?.angle ?? 0
      const radialOk =
        childAfter &&
        Math.abs(angleAfter - angleBefore) < 0.001 &&
        distAfter > distBefore + 5

      const insert = await page.$('[data-testid^="insert-handle-"]')
      if (insert) {
        await insert.click()
        await page.waitForTimeout(300)
      }
      await page.screenshot({ path: path.join(scratch, `step-insert-${runId}.png`), fullPage: true })
      const nodesAfterInsert = await readNodes(page)
      const hasInsert = nodesAfterInsert.some((n) => n.kind === 'edge-insert')
      const insertDistanceCheck = checkInsertChildDistance(nodesAfterInsert)
      const insertChildDistanceOk = insertDistanceCheck.ok

      const nodesBeforeSmall = nodesAfterInsert.length
      await page.selectOption('label:has-text("New node size") select', 'small')
      await dragPerimeter(page, rootId, 180)
      await page.waitForTimeout(200)
      const nodesAfterSmall = (await readNodes(page)).length
      const smallChildPlaced = nodesAfterSmall > nodesBeforeSmall

      // Root re-select after deselect: click bg then root core
      await page.locator('svg[data-testid="node-graph"]').click({ position: { x: 10, y: 10 }, force: true })
      await page.waitForTimeout(100)
      await page.click(`[data-testid="node-select-core-${rootId}"]`)
      await page.waitForTimeout(100)
      const nodesAfterRootSelect = await readNodes(page)
      const rootSelected = nodesAfterRootSelect.some((n) => n.id === `node-${rootId}` && n.selected)

      await page.keyboard.press('Delete')
      await page.waitForTimeout(300)
      const nodesAfterDelete = await readNodes(page)

      await page.screenshot({ path: path.join(scratch, `launch-screenshot-${runId}.png`), fullPage: true })

      transcript.ok =
        errs.length === 0 &&
        box &&
        box.width > 100 &&
        radialOk &&
        hasInsert &&
        insertChildDistanceOk &&
        smallChildPlaced &&
        rootSelected &&
        nodesAfterDelete.length === 0

      Object.assign(transcript, {
        errs,
        svgDim: box,
        nodesBefore: nodesBefore.length,
        nodesAfterRoot: nodesAfterRoot.length,
        nodesAfterPlace1: nodesAfterPlace1.length,
        nodesAfterPlace2: nodesAfterPlace2.length,
        distBefore,
        distAfter,
        angleBefore,
        angleAfter,
        radialOk,
        hasInsert,
        insertChildDistanceOk,
        insertDistanceCheck,
        smallChildPlaced,
        rootSelected,
        nodesAfterInsert: nodesAfterInsert.length,
        nodesAfterDelete: nodesAfterDelete.length,
        drag1,
      })
    } finally {
      if (browser) await browser.close()
    }
  } catch (e) {
    transcript.error = e?.message ?? String(e)
    transcript.ok = false
  } finally {
    if (preview) {
      preview.kill('SIGTERM')
      await sleep(500)
    }
    console.log(JSON.stringify(transcript))
  }

  return transcript.ok
}

killPort(PORT)
await sleep(500)
const first = await runOnce(1)
await sleep(1500)
const second = await runOnce(2)
process.exit(first && second ? 0 : 1)