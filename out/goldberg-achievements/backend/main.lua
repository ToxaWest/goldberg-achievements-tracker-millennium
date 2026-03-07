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
    if not content then return nil end
    local status, result = pcall(json.decode, content)
    return status and result or nil
end

-- Exposed Methods wrapped in pcall for stability
local function GetGameConfig(payload)
    print("GSE: GetGameConfig called. Type: " .. type(payload))
    local app_id = tostring(type(payload) == "table" and (payload.app_id or payload[1]) or payload or "nil")
    print("GSE: Detected AppID: " .. app_id)
    
    local cfg = configs[app_id] or {}
    return json.encode(cfg)
end

local function SaveGameConfig(payload)
    local status, result = pcall(function()
        if type(payload) ~= "table" then error("Payload must be a table, got " .. type(payload)) end
        
        local app_id = tostring(payload.app_id or "")
        if app_id == "" then error("Missing app_id in payload") end
        
        print("GSE: Saving config for " .. app_id)
        
        configs[app_id] = { 
            interface_path = payload.interface_path or "", 
            status_path = payload.status_path or "" 
        }
        
        local success = safe_write_file(settings_path, json.encode(configs))
        
        -- Refresh status map
        local status_content = safe_read_file(payload.status_path)
        if status_content then
            last_status_map[app_id] = safe_decode(status_content)
        end
        
        return json.encode({ success = success })
    end)
    
    if not status then
        print("GSE Save Error: " .. tostring(result))
        return json.encode({ success = false, error = tostring(result) })
    end
    return result
end

local function GetAchievements(payload)
    local app_id = tostring(type(payload) == "table" and (payload.app_id or payload[1]) or payload or "nil")
    print("GSE: GetAchievements for " .. app_id)
    
    local config = configs[app_id]
    if not config then return json.encode({}) end
    
    local meta = safe_decode(safe_read_file(config.interface_path)) or {}
    local status = safe_decode(safe_read_file(config.status_path)) or {}
    
    local result = {}
    for _, ach in ipairs(meta) do
        local ach_status = status[ach.name] or {}
        table.insert(result, {
            name = ach.name,
            display_name = ach.display_name or ach.name,
            unlocked = ach_status.unlocked or false,
            unlock_time = ach_status.unlock_time or 0
        })
    end
    return json.encode(result)
end

-- Lifecycle
local function on_load()
    print("GSE Achievements: Loading from " .. settings_path)
    local content = safe_read_file(settings_path)
    if content then configs = safe_decode(content) or {} end
    
    for app_id, config in pairs(configs) do
        local status_data = safe_decode(safe_read_file(config.status_path))
        if status_data then last_status_map[app_id] = status_data end
    end
    
    millennium.ready()
end

return {
    on_load = on_load,
    on_frontend_loaded = function() print("GSE: Frontend Connected") end,
    on_unload = function() print("GSE: Unloading") end,
    get_game_config = GetGameConfig,
    save_game_config = SaveGameConfig,
    get_achievements = GetAchievements,
    get_all_configs = function() return json.encode(configs) end
}
