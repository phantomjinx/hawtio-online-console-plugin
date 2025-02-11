const webpack = require('webpack')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const InterpolateHtmlPlugin = require('interpolate-html-plugin')
const { ConsoleRemotePlugin } = require('@openshift-console/dynamic-plugin-sdk-webpack')
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin')
const path = require('path')
const { dependencies } = require('./package.json')

const common = (mode, publicPath, env) => {
  // hawtio-online-console-plugin
  const pluginName = env.PLUGIN_NAME.replace('@', '').replace('/', '-')
  const packageVersion = env.PACKAGE_VERSION

  console.log(`Compilation Mode: ${process.env.NODE_ENV}`)
  console.log(`Public Path: ${publicPath}`)
  console.log(`Plugin Name: ${pluginName}`)
  console.log(`Package Version: ${packageVersion}`)

  return {

    context: path.resolve(__dirname, 'src'),

    // No regular entry points needed.
    // All plugin related scripts are generated via ConsoleRemotePlugin.
    entry: {},
    mode: mode,

    module: {
      rules: [
        {
          test: /\.(jsx?|tsx?)$/,
          exclude: /\/node_modules\//,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: path.resolve(__dirname, 'tsconfig.json'),
              },
            },
          ],
        },
        {
          test: /\.(sa|sc|c)ss$/,
          use: [ 'style-loader', 'css-loader', 'sass-loader' ],
          include: [ /node_modules/, /\.css$/ ],
          sideEffects: false
        },
        {
          test: /\.(svg|woff2?|ttf|eot|otf)(\?.*$|$)/,
          type: 'asset/resource',
          // only process modules with this loader
          // if they live under a 'fonts' or 'pficon' directory
          include: [ /node_modules/ ],
          generator: {
            filename: mode === 'production' ? 'assets/[contenthash][ext]' : 'assets/[name][ext]',
          },
        },
        {
          test: /\.svg$/,
          type: 'asset/inline',
          include: (input) => input.indexOf('background-filter.svg') > 1,
          use: [
            {
              options: {
                limit: 5000,
                outputPath: 'svgs',
                name: '[name].[ext]',
              },
            },
          ],
        },
        {
          test: /\.(jpg|jpeg|png|gif)$/i,
          include: [ /node_modules/ ],
          type: 'asset/inline',
          use: [
            {
              options: {
                limit: 5000,
                outputPath: 'images',
                name: '[name].[ext]',
              },
            },
          ],
        },
        {
          test: /\.(m?js)$/,
          resolve: {
            fullySpecified: false,
          },
        },
      ]
    },
    plugins: [
      new ConsoleRemotePlugin({
        validateSharedModules: true,
        pluginMetadata: {
          name: pluginName,
          version: packageVersion,
          displayName: "HawtIO OpenShift Console Plugin",
          description: "HawtIO Plugin serving integrated UI in OpenShift Console.",
          exposedModules: {
            ExamplePage: "./pages/ExamplePage",
            HawtioMainTab: "./pages/HawtioMainTab",
            HawtioMainPrefs: "./pages/HawtioMainPrefs"
          },
          dependencies: {
            "@console/pluginAPI": "*"
          }
        }
      }),
      new CopyWebpackPlugin({
        patterns: [{ from: path.resolve(__dirname, 'locales'), to: 'locales' }],
      }),
      new HtmlWebpackPlugin({
        inject: true,
        template: path.resolve(__dirname, 'public', 'index.html'),
        favicon: path.resolve(__dirname, 'public', 'favicon.ico'),
        publicPath: publicPath === '/' ? '' : publicPath,
      }),
      new webpack.DefinePlugin({
        'process.env': JSON.stringify(process.env),
        HAWTIO_ONLINE_PACKAGE_PLUGIN_NAME: JSON.stringify(pluginName),
        HAWTIO_ONLINE_PACKAGE_VERSION: JSON.stringify(packageVersion),
        HAWTIO_ONLINE_PUBLIC_PATH: JSON.stringify(publicPath),
      }),
    ],
    output: {
      path: path.resolve(__dirname, 'dist'),
      // Set base path to desired publicPath
      publicPath: publicPath,
      pathinfo: true,
      filename: mode === 'production' ? '[name]-bundle-[hash].min.js' : '[name]-bundle.js',
      chunkFilename: mode === 'production' ? '[name]-chunk-[chunkhash].min.js' : '[name]-chunk.js',
    },
    resolve: {
      modules: ['node_modules'],
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      plugins: [
        new TsconfigPathsPlugin({
          configFile: path.resolve(__dirname, './tsconfig.json'),
        }),
      ],
      fallback: {
        http: require.resolve("stream-http"),
        url: require.resolve("url"),
      },
      symlinks: false,
      cacheWithContext: false,
    },
    // For suppressing warnings that stop app running
    ignoreWarnings: [
      // For suppressing sourcemap warnings coming from some dependencies
      /Failed to parse source map/,
      /Critical dependency: the request of a dependency is an expression/,
    ]
  }
}

module.exports = { common }
