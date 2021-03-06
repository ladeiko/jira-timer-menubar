const webpack = require('webpack');
const merge = require('webpack-merge');
const baseConfig = require('./webpack.config.base');

const port = process.env.PORT || 9000;

const config = merge(baseConfig, {
  devtool: 'eval',

  entry: [
    'babel-polyfill',
    `webpack-hot-middleware/client?reload=true&path=http://localhost:${port}/__webpack_hmr`,
    './renderer/index',
  ],

  output: {
    publicPath: `http://localhost:${port}/dist/`,
  },

  mode: 'development',

  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('development'),
      },
    }),
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin(),
  ],
});

module.exports = config;
