# Nodal Builder

Interactive radial node graph builder — pie-wedge placement on circular hubs. Click a node's ring, drag outward, release to branch.

**Live demo:** https://rblalock.github.io/node-builder/

## Try locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5180/

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run test` | Unit tests |

## Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `node-builder`).
2. Push this project to the `main` branch:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin git@github.com:<username>/<repo>.git
   git push -u origin main
   ```

3. In the repo on GitHub: **Settings → Pages → Build and deployment**
   - Source: **GitHub Actions**
4. The `Deploy to GitHub Pages` workflow runs on every push to `main`. It tests, builds, and publishes `dist`.
5. Your demo URL: `https://<username>.github.io/<repo>/`

The Vite `base` path is set automatically from the repository name in CI, so asset URLs work on GitHub Pages without extra config.

### Custom base path (optional)

For local production preview mimicking GitHub Pages:

```bash
VITE_BASE_PATH=/node-builder/ npm run build && npm run preview
```

## Controls

- **Outer ring** — start a new branch (drag outward to set distance)
- **Center** — select / radial reposition (child nodes)
- **New node size** — size of the next placed node
- **Esc** — cancel placement
- **Delete** — remove selected node