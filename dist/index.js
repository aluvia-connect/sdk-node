"use strict";
// Aluvia Client Node
// Main entry point
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProxyStartError = exports.ApiError = exports.InvalidUserTokenError = exports.MissingUserTokenError = exports.AluviaClient = void 0;
// Public class
var AluviaClient_1 = require("./AluviaClient");
Object.defineProperty(exports, "AluviaClient", { enumerable: true, get: function () { return AluviaClient_1.AluviaClient; } });
// Public error classes
var errors_1 = require("./errors");
Object.defineProperty(exports, "MissingUserTokenError", { enumerable: true, get: function () { return errors_1.MissingUserTokenError; } });
Object.defineProperty(exports, "InvalidUserTokenError", { enumerable: true, get: function () { return errors_1.InvalidUserTokenError; } });
Object.defineProperty(exports, "ApiError", { enumerable: true, get: function () { return errors_1.ApiError; } });
Object.defineProperty(exports, "ProxyStartError", { enumerable: true, get: function () { return errors_1.ProxyStartError; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBLHFCQUFxQjtBQUNyQixtQkFBbUI7OztBQUVuQixlQUFlO0FBQ2YsK0NBQThDO0FBQXJDLDRHQUFBLFlBQVksT0FBQTtBQUVyQix1QkFBdUI7QUFDdkIsbUNBS2tCO0FBSmhCLCtHQUFBLHFCQUFxQixPQUFBO0FBQ3JCLCtHQUFBLHFCQUFxQixPQUFBO0FBQ3JCLGtHQUFBLFFBQVEsT0FBQTtBQUNSLHlHQUFBLGVBQWUsT0FBQSIsInNvdXJjZXNDb250ZW50IjpbIi8vIEFsdXZpYSBDbGllbnQgTm9kZVxuLy8gTWFpbiBlbnRyeSBwb2ludFxuXG4vLyBQdWJsaWMgY2xhc3NcbmV4cG9ydCB7IEFsdXZpYUNsaWVudCB9IGZyb20gJy4vQWx1dmlhQ2xpZW50JztcblxuLy8gUHVibGljIGVycm9yIGNsYXNzZXNcbmV4cG9ydCB7XG4gIE1pc3NpbmdVc2VyVG9rZW5FcnJvcixcbiAgSW52YWxpZFVzZXJUb2tlbkVycm9yLFxuICBBcGlFcnJvcixcbiAgUHJveHlTdGFydEVycm9yLFxufSBmcm9tICcuL2Vycm9ycyc7XG5cbi8vIFB1YmxpYyB0eXBlc1xuZXhwb3J0IHR5cGUge1xuICBHYXRld2F5UHJvdG9jb2wsXG4gIExvZ0xldmVsLFxuICBBbHV2aWFDbGllbnRPcHRpb25zLFxuICBBbHV2aWFDbGllbnRTZXNzaW9uLFxufSBmcm9tICcuL3R5cGVzJztcbiJdfQ==