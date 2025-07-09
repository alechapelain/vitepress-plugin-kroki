/**
 * Options for configuring the diagrams plugin
 */
export interface DiagramPluginOptions {
  /**
   * Custom directory to store generated diagram SVGs
   * @default "docs/public/diagrams"
   */
  diagramsDir?: string;

  /**
   * Custom public path for serving diagram images
   * @default "diagrams"
   */
  publicPath?: string;

  /**
   * BaseUrl for kroki, useful when using self-hosted instances
   * @default "https://kroki.io"
   */
  krokiBaseUrl?: string;

  /**
   * Custom fetch to set proxy or specific network configuration
   * @param input
   * @param init
   */
  customFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

/**
 * Extracted diagram metadata from markdown tokens
 */
export interface DiagramMetadata {
  /**
   * Optional unique identifier for the diagram
   */
  id?: string;

  /**
   * Optional caption for the diagram
   */
  caption?: string;
}
