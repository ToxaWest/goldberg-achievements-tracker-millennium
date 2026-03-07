local millennium = require("millennium")
local json = require("json")

-- Resolve absolute path safely
local function get_plugin_dir()
    local path = "."
    if millennium.get_install_path then path = millennium.get_install_path() end
    return path:gsub("\\", "/"):gsub("/$", "")
end

local plugin_dir = get_plugin_dir()
local settings_path = plugin_dir .. "/settings.json"

local configs = {}
local last_status_map = {}

-- Safe File/JSON Helpers
local function safe_read_file(path)
    if not path or path == "" then return nil end
    local f = io.open(path, "rb")
    if not f then return nil end
    local content = f:read("*all")
    f:close()
    return content
end

local function safe_write_file(path, content)
    local f = io.open(path, "wb")
    if not f then return false end
    f:write(content)
    f:close()
    return true
end

local function safe_decode(content)
    if not content or type(content) ~= "string" then return content end
    local status, result = pcall(json.decode, content)
    return status and result or nil
end

-- Robust Argument Normalization
local function get_args(...)
    local args = {...}
    print("GSE Debug: Received " .. #args .. " arguments")
    for i, v in ipairs(args) do
        print("  Arg[" .. i .. "] type: " .. type(v) .. " value: " .. tostring(v))
    end

    local payload = args[1]
    if type(payload) == "string" then
        local decoded = safe_decode(payload)
        if type(decoded) == "table" then
            print("GSE Debug: Decoded string payload into table")
            return decoded
        end
    end
    
    if type(payload) == "table" then return payload end
    
    -- Fallback: positional
    return {
        app_id = args[1],
        interface_path = args[2],
        status_path = args[3]
    }
end

-- Exposed Methods
function get_game_config(...)
    local payload = get_args(...)
    local app_id = tostring(payload.app_id or "nil")
    print("GSE: get_game_config for " .. app_id)
    local cfg = configs[app_id] or {}
    return json.encode(cfg)
end

function save_game_config(...)
    local payload = get_args(...)
    local app_id = tostring(payload.app_id or "")
    print("GSE: save_game_config for " .. app_id)
    
    if app_id == "" then 
        return json.encode({ success = false, error = "Missing AppID" }) 
    end

    configs[app_id] = { 
        interface_path = payload.interface_path or "", 
        status_path = payload.status_path or "" 
    }
    
    local success = safe_write_file(settings_path, json.encode(configs))
    
    local status_data = safe_decode(safe_read_file(payload.status_path))
    if status_data then last_status_map[app_id] = status_data end
    
    return json.encode({ success = success })
end

function get_achievements(...)
    local payload = get_args(...)
    local app_id = tostring(payload.app_id or "nil")
    print("GSE: get_achievements for " .. app_id)
    
    local config = configs[app_id]
    if not config then return json.encode({}) end
    
    local meta = safe_decode(safe_read_file(config.interface_path)) or {}
    local status = safe_decode(safe_read_file(config.status_path)) or {}
    
    local result = {}
    for _, ach in ipairs(meta) do
        if type(ach) == "table" and ach.name then
            local ach_status = status[ach.name] or {}
            table.insert(result, {
                name = ach.name,
                display_name = ach.display_name or ach.name,
                unlocked = ach_status.unlocked or false,
                unlock_time = ach_status.unlock_time or 0
            })
        end
    end
    return json.encode(result)
end

function get_all_configs()
    return json.encode(configs)
end

-- Lifecycle
local function on_load()
    print("GSE Achievements: Loading from " .. settings_path)
    local content = safe_read_file(settings_path)
    if content then configs = safe_decode(content) or {} end
    millennium.ready()
end

return {
    on_load = on_load,
    on_frontend_loaded = function() print("GSE: Frontend Connected") end,
    on_unload = function() print("GSE: Unloading") end,
    get_game_config = get_game_config,
    save_game_config = save_game_config,
    get_achievements = get_achievements,
    get_all_configs = get_all_configs
}
