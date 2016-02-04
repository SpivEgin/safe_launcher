var ref = require('ref');
var int = ref.types.int;
var ArrayType = require('ref-array');
var util = require('./util.js');

var intPtr = ref.refType(int);
var IntArray = ArrayType(int);
var clientHandle = ref.types.void;
var clientHandlePtr = ref.refType(clientHandle);
var clientHandlePtrPtr = ref.refType(clientHandlePtr);

var safeDriveKey;
var registeredClientHandle;
var unregisteredClientHandle;

var unregisteredClient = function(lib, request) {
  var unregisteredClient = ref.alloc(clientHandlePtrPtr);
  /*jscs:disable requireCamelCaseOrUpperCaseIdentifiers*/
  var result = lib.create_unregistered_client(unregisteredClient);
  /*jscs:enable requireCamelCaseOrUpperCaseIdentifiers*/
  if (result !== 0) {
    return false;
  }
  unregisteredClientHandle = unregisteredClient.deref();
  return true;
};

var setSafeDriveKey = function(lib) {
  var size;
  try {
    size = getSafeDriveKeySize(lib);
  } catch (e) {
    return e;
  }
  var content = new IntArray(size);
  /*jscs:disable requireCamelCaseOrUpperCaseIdentifiers*/
  var result = lib.get_safe_drive_key(content, registeredClientHandle);
  /*jscs:enable requireCamelCaseOrUpperCaseIdentifiers*/
  if (result !== 0) {
    return new Error('Failed with error code ' + result);
  }
  safeDriveKey = new Buffer(content).toString('base64');
  return;
};

var getSafeDriveKeySize = function(lib) {
  var size = ref.alloc('int');
  /*jscs:disable requireCamelCaseOrUpperCaseIdentifiers*/
  var res = lib.get_safe_drive_key_size(size, registeredClientHandle);
  /*jscs:enable requireCamelCaseOrUpperCaseIdentifiers*/
  if (res === 0) {
    return size.deref();
  }
  throw new Error('Failed with error code' + res);
};

var register = function(lib, request) {
  var params = request.params;
  var regClient = ref.alloc(clientHandlePtrPtr);
  var res;
  try {
    /*jscs:disable requireCamelCaseOrUpperCaseIdentifiers*/
    res = lib.create_account(params.keyword, params.pin, params.password, regClient);
    /*jscs:enable requireCamelCaseOrUpperCaseIdentifiers*/
  } catch (e) {
    return util.sendError(request.id, 999, e.message());
  }
  if (res !== 0) {
    return util.sendError(request.id, res);
  }
  registeredClientHandle = regClient.deref();
  var safeDriveError = setSafeDriveKey(lib);
  if (safeDriveError) {
    return util.sendError(request.id, 999, safeDriveError.toString());
  }
  util.send(request.id);
};

var login = function(lib, request) {
  var params = request.params;
  var regClient = ref.alloc(clientHandlePtrPtr);
  var res;
  try {
    /*jscs:disable requireCamelCaseOrUpperCaseIdentifiers*/
    res = lib.log_in(params.keyword, params.pin, params.password, regClient);
    /*jscs:enable requireCamelCaseOrUpperCaseIdentifiers*/
  } catch (e) {
    return util.sendError(request.id, 999, e.message());
  }
  if (res !== 0) {
    return util.sendError(request.id, res);
  }
  registeredClientHandle = regClient.deref();
  util.send(request.id);
};

exports.getRegisteredClient = function() {
  return registeredClientHandle;
};

exports.getSafeDriveKey = function() {
  return safeDriveKey;
};

exports.getUnregisteredClient = function() {
  if (!unregisteredClientHandle && !unregisteredClient()) {
    return;
  }
  return unregisteredClientHandle;
};

var getAppDirectoryKey = function(lib, request) {
  try {
    if (!registeredClientHandle) {
      return util.sendError(request.id, 999, 'Client Handle not available');
    }
    var params = request.params;
    var size = ref.alloc('int');
    /*jscs:disable requireCamelCaseOrUpperCaseIdentifiers*/
    var res = lib.get_app_dir_key_size(params.appName, params.appId, params.vendor, size, registeredClientHandle);
    /*jscs:enable requireCamelCaseOrUpperCaseIdentifiers*/
    if (res !== 0) {
      return util.sendError(new Error('Failed with code' + res));
    }
    var keySize = size.deref();
    var content = new IntArray(keySize);
    /*jscs:disable requireCamelCaseOrUpperCaseIdentifiers*/
    var result = lib.get_app_dir_key(params.appName, params.appId, params.vendor, content, registeredClientHandle);
    /*jscs:enable requireCamelCaseOrUpperCaseIdentifiers*/
    if (result !== 0) {
      return new Error('Failed with error code ' + result);
    }
    util.send(request.id, new Buffer(content).toString('base64'));
  } catch(e) {
    util.sendError(request.id, 999, e.message());
  }
};

exports.drop = function(lib) {
  if (unregisteredClientHandle) {
    /*jscs:disable requireCamelCaseOrUpperCaseIdentifiers*/
    lib.drop_client(unregisteredClientHandle);
    /*jscs:enable requireCamelCaseOrUpperCaseIdentifiers*/
  }
  if (registeredClientHandle) {
    /*jscs:disable requireCamelCaseOrUpperCaseIdentifiers*/
    lib.drop_client(registeredClientHandle);
    /*jscs:enable requireCamelCaseOrUpperCaseIdentifiers*/
  }
};

exports.getMethods = function() {
  return {
    'create_unregistered_client': [ 'int', [ clientHandlePtrPtr ] ],
    'create_account': [ 'int', [ 'string', 'string', 'string', clientHandlePtrPtr ] ],
    'log_in': [ 'int', [ 'string', 'string', 'string', clientHandlePtrPtr ] ],
    'get_safe_drive_key_size': [ 'int', [ intPtr, clientHandlePtrPtr ] ],
    'get_safe_drive_key': [ 'int', [ IntArray, clientHandlePtrPtr ] ],
    'get_app_dir_key_size': [ 'int', [ 'string', 'string', 'string', intPtr, clientHandlePtrPtr ] ],
    'get_app_dir_key': [ 'int', [ 'string', 'string', 'string', IntArray, clientHandlePtrPtr ] ],
    'drop_client': [ 'void', [ clientHandlePtrPtr ] ]
  };
};

exports.execute = function(lib, request) {
  switch (request.action) {
    case 'register':
      register(lib, request);
      break;
    case 'login':
      login(lib, request);
      break;
    case 'app-dir-key':
      getAppDirectoryKey(lib, request);
      break;
    default:
      util.sendError(request.id, 999, 'Invalid Action');
  }
};
