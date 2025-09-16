# Mindmapper React Canvas Seed

This branch starts the React rewrite of Mindmapper with the smallest possible feature set. The app renders a full-screen canvas and draws a single placeholder "Root" node so we can verify rendering, resizing, and device pixel ratio handling.

## Prerequisites
- Node.js 18+
- npm 9+

## Install and run locally
```bash
npm install
npm run dev
```

The dev server prints a local URL (default `http://localhost:5173`). Open it to see the centered purple root node. Resize the window to confirm the canvas remains responsive.

## Build for production
```bash
npm run build
```
