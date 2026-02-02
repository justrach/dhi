const path = require('path');

module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'worker.js',
    path: path.resolve(__dirname, 'webpack-dist'),
    library: {
      type: 'module',
    },
  },
  experiments: {
    outputModule: true,
  },
  mode: 'production',
  target: 'webworker',
  resolve: {
    extensions: ['.ts', '.js'],
    // Tell webpack to use the 'worker' or 'workerd' condition
    conditionNames: ['workerd', 'worker', 'import', 'module', 'default'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.wasm$/,
        type: 'asset/resource',
      },
    ],
  },
  externals: {
    // Don't bundle Cloudflare-specific modules
    'cloudflare:workers': 'cloudflare:workers',
  },
};
