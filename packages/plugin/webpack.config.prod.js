/* eslint-env node */
const webpack = require('webpack')
const { merge } = require('webpack-merge')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const path = require('path')
const { common } = require('./webpack.config.common.js')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

module.exports = (env, argv) => {

  //
  // Prefix path will be determined by the installed web server platform
  //
  const publicPath = '/'

  return merge(common('production', publicPath, env), {

    devtool: 'source-map',

    stats: {
      // Display bailout reasons
      optimizationBailout: true,
      logging: 'verbose',
      usedExports: false,
      dependentModules: true,
    },

    optimization: {
      sideEffects: false,
      minimizer: [
        new TerserPlugin({
          exclude: [ /\.css/, /\.scss/ ],
        }),
      ],
    },

    plugins: [
      new CopyWebpackPlugin({
        patterns: [ { from: path.resolve(__dirname, 'public', 'hawtio-logo.svg'), to: 'hawtio-logo.svg' }],
      })
    ]
  })
}
