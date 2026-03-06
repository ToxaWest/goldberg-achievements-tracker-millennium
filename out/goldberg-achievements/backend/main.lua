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

-- Achievement Tracking
local function check_achievements()
    for app_id, config in pairs(configs) do
        local status_path = config.status_path
        local content = safe_read_file(status_path)
        local current_status = safe_decode(content)
        
        if current_status then
            local last_status = last_status_map[app_id] or {}
            for ach_id, data in pairs(current_status) do
                if data.unlocked and not (last_status[ach_id] and last_status[ach_id].unlocked) then
                    print("GSE: New Achievement! " .. app_id .. ":" .. ach_id)
                    
                    local name = ach_id
                    local meta = safe_decode(safe_read_file(config.interface_path))
                    if meta then
                        for _, a in ipairs(meta) do
                            if a.name == ach_id then name = a.display_name or ach_id break end
                        end
                    end
                    
                    millennium.emit("achievement_earned", { app_id = app_id, name = name })
                end
            end
            last_status_map[app_id] = current_status
        end
    end
end

-- Exposed Methods
local function get_game_config(payload)
    return configs[tostring(payload.app_id)] or {}
end

local function save_game_config(payload)
    local app_id = tostring(payload.app_id)
    configs[app_id] = { interface_path = payload.interface_path, status_path = payload.status_path }
    local success = safe_write_file(settings_path, json.encode(configs))
    
    local status = safe_decode(safe_read_file(payload.status_path))
    if status then last_status_map[app_id] = status end
    return { success = success }
end

local function get_achievements(payload)
    local app_id = tostring(payload.app_id)
    local config = configs[app_id]
    if not config then return {} end
    
    local meta = safe_decode(safe_read_file(config.interface_path)) or {}
    local status = safe_decode(safe_read_file(config.status_path)) or {}
    
    for _, ach in ipairs(meta) do
        local ach_status = status[ach.name] or {}
        ach.unlocked = ach_status.unlocked or false
        ach.unlock_time = ach_status.unlock_time or 0
    end
    return meta
end

-- Lifecycle
local function on_load()
    print("GSE Achievements: Loading from " .. settings_path)
    local content = safe_read_file(settings_path)
    if content then configs = safe_decode(content) or {} end
    
    for app_id, config in pairs(configs) do
        local status = safe_decode(safe_read_file(config.status_path))
        if status then last_status_map[app_id] = status end
    end
    
    if Steam and Steam.SetInterval then Steam.SetInterval(3000, check_achievements) end
    millennium.ready()
end

return {
    on_load = on_load,
    on_frontend_loaded = function() print("GSE: Frontend Connected") end,
    on_unload = function() print("GSE: Unloading") end,
    get_game_config = get_game_config,
    save_game_config = save_game_config,
    get_achievements = get_achievements
}
