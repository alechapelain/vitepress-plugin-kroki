import { type DiagramType, SUPPORTED_DIAGRAM_TYPES } from "./constants";
import { extractDiagramMetadata } from "./utils";
import type { Call, DiagramPluginOptions } from "./types";
import type { MarkdownRenderer } from "vitepress";
import { diagramToSvg, getDiagramContent } from "./generation";

const $calls: Call[] = []

/**
 * Configure VitePress markdown renderer to support diagram generation
 * @param md Markdown renderer
 * @param diagramsPluginOptions Plugin configuration options
 */
export function markdownItGenerateDiagramsPlugin(
    md: MarkdownRenderer,
    diagramsPluginOptions: DiagramPluginOptions = {},
): void {
  const defaultFence = md.renderer.rules.fence!;

  md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
    const token = tokens[idx];
    const diagramType = token.info.trim().replace(':file', '').toLowerCase();

    // Check if the code block is a supported diagram type
    if (SUPPORTED_DIAGRAM_TYPES.includes(diagramType as DiagramType)) {
      const { caption, id } = extractDiagramMetadata(tokens, idx);

      return diagramToSvg(
          $calls,
          getDiagramContent(token, diagramsPluginOptions),
          diagramType,
          caption,
          id,
          diagramsPluginOptions,
      );
    }

    // For all other code blocks, use the default renderer
    return defaultFence(tokens, idx, options, env, slf);
  };
}

/**
 * Using a vite plugin to make http calls during build time
 * note: emit to update dist files after retrieval
 */
export function viteGenerateDiagramsPlugin() {
  let hasRun = false;
  return {
    name: 'generateDiagrams',
    // dev mode
    async configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!hasRun && $calls && $calls.length !== 0) {
          hasRun = true;
          await Promise.all($calls.map(async ($call) => {
            await $call.getDiagram()
          }))
        }

        next();
      })
    },
    // build mode
    async generateBundle() {
      if ($calls && $calls.length !== 0) {
        await Promise.all($calls.map(async ($call) => {
          const result = await $call.getDiagram()
          this.emitFile(result);
        }))
      }
    },
  }
}

export { SUPPORTED_DIAGRAM_TYPES } from "./constants";
export type { DiagramMetadata, DiagramPluginOptions } from "./types";