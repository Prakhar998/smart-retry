"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitState = exports.ErrorCategory = void 0;
var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["TRANSIENT"] = "TRANSIENT";
    ErrorCategory["OVERLOAD"] = "OVERLOAD";
    ErrorCategory["TIMEOUT"] = "TIMEOUT";
    ErrorCategory["PERMANENT"] = "PERMANENT";
    ErrorCategory["UNKNOWN"] = "UNKNOWN";
})(ErrorCategory || (exports.ErrorCategory = ErrorCategory = {}));
var CircuitState;
(function (CircuitState) {
    CircuitState["CLOSED"] = "CLOSED";
    CircuitState["OPEN"] = "OPEN";
    CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (exports.CircuitState = CircuitState = {}));
//# sourceMappingURL=types.js.map