const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

const bundleOptimizations = {
  runtimeChunk: "single",
  splitChunks: {
    chunks: "all",
    maxInitialRequests: Infinity,
    minSize: 0,
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name(module) {
          // get the name. E.g. node_modules/packageName/not/this/part.js
          // or node_modules/packageName
          const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];

          // npm package names are URL-safe, but some servers don't like @ symbols
          return `npm.${packageName.replace("@", "")}`;
        },
      },
    },
  },
};

const tsLoaderRules = {
  test: /\.tsx?$/,
  use: "ts-loader",
};

const outputFormatting = {
  filename: "[name].js",
  path: path.resolve(__dirname, "../deploy/public"),
  chunkFilename: "[name].[contenthash].js",
};

const sharedConfig = {
  entry: {
    frontend: "./src/index.ts",
  },
  target: "web",
  module: {
    rules: [tsLoaderRules],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/index.html"
    })
  ],
  resolve: {
    extensions: [".ts", ".js", ".json", ".tsx", ".jsx"],
  },
  output: outputFormatting,
  optimization: bundleOptimizations,
};

const prodWebpackConfig = {
  mode: "production",
  name: "prod",
  ...sharedConfig,
};

const devWebpackConfig = {
  mode: "development",
  name: "dev",
  ...sharedConfig,
};

module.exports = [prodWebpackConfig, devWebpackConfig];
