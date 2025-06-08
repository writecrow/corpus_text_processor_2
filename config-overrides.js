const webpack = require("webpack")

module.exports = function override(config, env) {
  // Get rid of hash for js files
  config.output.filename = "static/js/[name].js"
  config.output.chunkFilename = "static/js/[name].chunk.js"

  // Get rid of hash for css files
  const miniCssExtractPlugin = config.plugins.find(element => element.constructor.name === "MiniCssExtractPlugin");
  miniCssExtractPlugin.options.filename = "static/css/[name].css"
  miniCssExtractPlugin.options.chunkFilename = "static/css/[name].css"

  // And the last thing: disabling splitting
  config.optimization.splitChunks = {
    cacheGroups: {
      default: false,
    },
  };
  config.optimization.runtimeChunk = false;
  config.plugins = [
    ...config.plugins,
    new webpack.optimize.LimitChunkCountPlugin({
      maxChunks: 1,
    }),
  ];
  return config;
};