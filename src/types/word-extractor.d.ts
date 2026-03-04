declare module 'word-extractor' {
  class WordExtractor {
    extract(input: Buffer | string): Promise<{
      getBody(): string
      getHeaders(): string
      getFootnotes(): string
    }>
  }
  export default WordExtractor
}
