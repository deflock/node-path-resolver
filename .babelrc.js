"use strict";

module.exports = {
    presets: [
        ["@babel/preset-env", {
            "targets": {
                "node": "8",
            },
            "modules": "commonjs",
        }],
    ],
    plugins: [],
};
