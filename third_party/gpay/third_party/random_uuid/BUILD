# Description:
#   JavaScript library for Random UUID generator.

load("@io_bazel_rules_closure//closure:defs.bzl", "closure_js_library", "closure_js_binary")

package(
    default_visibility = ["//visibility:public"],
    licenses = ["notice"],  # Dual MIT, GPL
)

exports_files(["LICENSE"])

exports_files(["Random.uuid.js"])

closure_js_library(
    name = "uuid",
    srcs = ["Random.uuid.js"],
    suppress = [
        "JSC_MISSING_JSDOC",
        "JSC_UNKNOWN_EXPR_TYPE",
    ],
)
