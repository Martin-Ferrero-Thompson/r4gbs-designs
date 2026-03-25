# Astro Starter Kit: Minimal

```sh
bun create astro@latest -- --template minimal
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `bun install`             | Installs dependencies                            |
| `bun dev`             | Starts local dev server at `localhost:4321`      |
| `bun build`           | Build your production site to `./dist/`          |
| `bun preview`         | Preview your build locally, before deploying     |
| `bun astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `bun astro -- --help` | Get help using the Astro CLI                     |

## �️ GPX Route Analyzer

A standalone CLI tool that parses Komoot GPX route files, extracts statistics, and optionally generates descriptive cycling copy using a local Ollama LLM.

### Usage

```sh
bun run analyze-gpx <file.gpx> [options]
```

### Options

| Flag | Description | Default |
| :--- | :---------- | :------ |
| `--no-llm` | Skip LLM content generation, output stats only | *(off — LLM enabled)* |
| `--model <name>` | Ollama model to use for content generation | `qwen3:14b` |
| `--output-dir <dir>` | Directory for output files | Same directory as the input GPX |

### Examples

```sh
# Full analysis with LLM-generated narrative (default model: qwen3:14b)
bun run analyze-gpx public/routes/The-Start.gpx

# Stats only, no LLM
bun run analyze-gpx public/routes/The-Start.gpx --no-llm

# Use a different Ollama model
bun run analyze-gpx public/routes/The-Start.gpx --model codestral:22b

# Write output to a custom directory
bun run analyze-gpx public/routes/The-Start.gpx --output-dir ./output
```

### Output

For an input file named `The-Start.gpx`, the tool produces:

- **With LLM** (e.g. `--model qwen3:14b`): `The-Start-qwen3-14b.md` and `The-Start-qwen3-14b.json`
- **With `--no-llm`**: `The-Start.md` and `The-Start.json`

The model name is included in the filename so you can compare outputs from different models side by side.

### Requirements

- [Ollama](https://ollama.com) running locally (default: `http://localhost:11434`). Set `OLLAMA_HOST` env var to override.
- A model pulled in Ollama (e.g. `ollama pull qwen3:14b`)
- Not required when using `--no-llm`

### What it extracts

- Total distance, elevation gain/loss, altitude range
- Per-segment breakdown (using GPX waypoints as segment boundaries)
- Notable climbs (sustained >4% gradient over >500m)
- Cardinal direction per segment
- LLM-generated: overview, segment narratives, terrain descriptions, evocative titles

## �👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
