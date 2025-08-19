export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">
          <span className="bg-gradient-to-r from-cyan-400 to-purple-600 bg-clip-text text-transparent">
            Embedocs
          </span>
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          AI That Actually Knows Your Docs
        </p>
        <div className="space-x-4">
          <a 
            href="https://github.com/romiluz13/EmbeDocs-MCP"
            className="inline-block px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg hover:opacity-90 transition"
          >
            Get Started
          </a>
          <a 
            href="https://www.npmjs.com/package/embedocs-mcp"
            className="inline-block px-6 py-3 border border-gray-600 rounded-lg hover:border-gray-400 transition"
          >
            View on npm
          </a>
        </div>
      </div>
    </div>
  )
}