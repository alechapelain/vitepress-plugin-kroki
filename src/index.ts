import * as fs from "node:fs";
import * as path from "node:path";
import { SUPPORTED_DIAGRAM_TYPES, type DiagramType } from "./constants";

import {
  extractDiagramMetadata,
  generateUniqueFilename,
  removeOldDiagramFiles,
  resolveDiagramBaseDir,
} from "./utils";
import type { DiagramPluginOptions } from "./types";
import type { MarkdownRenderer } from "vitepress";

/**
 * Configure VitePress markdown renderer to support diagram generation
 * @param md Markdown renderer
 * @param diagramsPluginOptions Plugin configuration options
 */
export async function configureDiagramsPlugin(
    md: MarkdownRenderer,
    diagramsPluginOptions: DiagramPluginOptions = {},
) {
  const defaultFence = md.renderer.rules.fence!;
  const $calls = []

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

  // Make all calls to generate diagrams at build time or before app start in dev mode
  await Promise.all($calls)
}

/**
 * Convert diagram to SVG and generate HTML representation
 * @param $calls
 * @param diagram Diagram content
 * @param diagramType Diagram type
 * @param caption Optional diagram caption
 * @param diagramId Optional diagram identifier
 * @param diagramsPluginOptions Plugin configuration options
 * @returns HTML string with diagram and optional caption
 */
export function diagramToSvg(
  $calls: Promise<void>[],
  diagram: string,
  diagramType: string,
  caption?: string,
  diagramId?: string,
  diagramsPluginOptions: DiagramPluginOptions = {}
): string {
  try {
    // Normalize line endings to \n
    const normalizedDiagram = diagram.replaceAll("\r\n", "\n");

    // Validate diagram type
    if (!SUPPORTED_DIAGRAM_TYPES.includes(diagramType as DiagramType)) {
      throw new Error(`Unsupported diagram type: ${diagramType}`);
    }

    // Use default or custom diagrams directory
    const diagramsDir = resolveDiagramBaseDir(
      diagramsPluginOptions.diagramsDir,
    );

    // Ensure diagrams directory exists
    fs.mkdirSync(diagramsDir, { recursive: true });

    // Generate unique filename
    const filename = generateUniqueFilename(
      diagramType as DiagramType,
      normalizedDiagram,
      diagramId,
    );

    const filepath = path.join(diagramsDir, filename);

    // Check if file exists and is not a placeholder
    const fileExists = fs.existsSync(filepath);

    if (!fileExists) {
      generateDiagram($calls, diagramsPluginOptions, diagramType, diagramsDir, normalizedDiagram, filename, filepath, diagramId)
    }

    const publicPath = diagramsPluginOptions.publicPath ?? "/diagrams";

    return getDiagramTemplate(diagramType, publicPath, filename, caption);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error converting ${diagramType} diagram:`, errorMessage);
    return `<div class="diagram-error">Error converting diagram: ${errorMessage}</div>`;
  }
}

/**
 * Get diagram template to add to vitepress pages
 * @param diagramType
 * @param publicPath
 * @param filename
 * @param caption
 */
function getDiagramTemplate(diagramType: string, publicPath: string, filename: string, caption?: string) {
  return `<figure 
      class="vpd-diagram vpd-diagram--${diagramType}" 
      onclick="
        const figure = this;
        const isFullscreen = figure.classList.contains('vpd-diagram--fullscreen');
        
        document.querySelectorAll('.vpd-diagram').forEach(diagram => {
          diagram.classList.remove('vpd-diagram--fullscreen');
        });

        if (!isFullscreen) {
          figure.classList.add('vpd-diagram--fullscreen');
        }
      "
    >
        <img 
          :src="\`${publicPath}/${filename}\`" 
          alt="${diagramType} Diagram" 
          class="vpd-diagram-image" 
        />
      ${caption
      ? `<figcaption class="vpd-diagram-caption">
        ${caption}
      </figcaption>`
      : ""
      }
    </figure>`
}

/**
 * Generate diagram using kroki
 * @param $calls
 * @param diagramsPluginOptions
 * @param diagramType
 * @param diagramId
 * @param diagramsDir
 * @param normalizedDiagram
 * @param filename
 * @param filepath
 */
function generateDiagram(
    $calls: Promise<void>[],
    diagramsPluginOptions: DiagramPluginOptions,
    diagramType: string,
    diagramsDir: string,
    normalizedDiagram: string,
    filename: string,
    filepath: string,
    diagramId?: string,
) {
  const call = diagramsPluginOptions.customFetch || fetch;
  const svgCall = call(`${diagramsPluginOptions.krokiBaseUrl || 'https://kroki.io'}/${diagramType}`, {
    method: "POST",
    headers: {
      Accept: "image/svg+xml",
      "Content-Type": "text/plain",
    },
    body: normalizedDiagram,
  })
      .then((res) => res.text())
      .then((svg) => {
        // Remove old files with the same diagram ID
        if (diagramId) {
          removeOldDiagramFiles(
              diagramsDir,
              diagramType as DiagramType,
              diagramId,
              filename,
          );
        }
        fs.writeFileSync(filepath, svg);
        console.log(`\n✓ Successfully generated diagram: ${filepath}`);
      })
      .catch((error) => {
        console.error('Error generating diagram:', error);
      });

  $calls.push(svgCall)
}

/**
 * Retrieve diagram content, either directly from content, or file if info contains :file
 * @param token
 * @param diagramsPluginOptions
 */
function getDiagramContent(token, diagramsPluginOptions: DiagramPluginOptions) {
  const diagram = token.content.trim();

  if (token.info.includes(':file')) {
    const diagramsDir = resolveDiagramBaseDir(
      diagramsPluginOptions.diagramsDir,
    );
    const filePath = path.join(diagramsDir, diagram);
    return fs.readFileSync(filePath).toString()
  } else {
    return diagram
  }
}

export { SUPPORTED_DIAGRAM_TYPES } from "./constants";
export type { DiagramMetadata, DiagramPluginOptions } from "./types";
