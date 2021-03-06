const path = require('path')
const esbuild = require('esbuild')
const { getOptions } = require('loader-utils')

const FILE_EXTS = ['.json', '.js', '.tsx', '.jsx', '.ts', '.text', '.base64']

const getLoader = (ext) => {
  if (!FILE_EXTS.includes(ext)) {
    throw Error(
      '[esbuild-loader] Please ensure the `rule.test` attribute of this loader filters for the following file types: ' +
        FILE_EXTS.join(',')
    )
  }

  return ext.slice(1)
}

module.exports = async function (source) {
  const done = this.async()
  const options = getOptions(this)
  /** @type {import('esbuild').Service} */
  const service = this._compiler.$esbuildService

  if (!service) {
    return done(
      new Error(
        `[esbuild-loader] You need to add ESBuildPlugin to your webpack config first`
      )
    )
  }

  try {
    const ext = path.extname(this.resourcePath)

    const result = await service.transform(source, {
      target: options.target || 'es2015',
      loader: getLoader(ext),
      jsxFactory: options.jsxFactory,
      jsxFragment: options.jsxFragment,
      sourcemap: options.sourceMap,
      sourcefile: options.sourceMap ? this.resourcePath : null,
    })
    done(null, result.js, result.jsSourceMap)
  } catch (err) {
    done(err)
  }
}

module.exports.ESBuildPlugin = class ESBuildPlugin {
  /**
   * @param {import('webpack').Compiler} compiler
   */
  apply(compiler) {
    let watching = false

    const startService = async () => {
      if (!compiler.$esbuildService) {
        compiler.$esbuildService = await esbuild.startService()
      }
    }

    compiler.hooks.run.tapPromise('esbuild', async () => {
      await startService()
    })
    compiler.hooks.watchRun.tapPromise('esbuild', async () => {
      watching = true
      await startService()
    })

    compiler.hooks.done.tap('esbuild', () => {
      if (!watching && compiler.$esbuildService) {
        compiler.$esbuildService.stop()
        compiler.$esbuildService = undefined
      }
    })
  }
}
