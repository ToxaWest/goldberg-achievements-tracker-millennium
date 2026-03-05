local filesystem = require("filesystem")
local cjson = require("cjson")

local settings_path = "settings.json"
local configs = {}
local last_status_map = {}

-- Utility to read and parse JSON
local function read_json(path)
    if not filesystem.exists(path) then return nil end
    local content = filesystem.read_file(path)
    local status, data = pcall(cjson.decode, content)
    if status then return data else return nil end
end

-- Utility to save JSON
local function save_json(path, data)
    local content = cjson.encode(data)
    return filesystem.write_file(path, content)
end

-- Load initial configurations
local function load_configs()
    local data = read_json(settings_path)
    if data then
        configs = data
        print("GSE Achievements: Configs loaded.")
    else
        configs = {}
        print("GSE Achievements: No config found, starting fresh.")
    end
end

-- Check for new achievements
local function check_achievements()
    for app_id, config in pairs(configs) do
        local status_path = config.status_path
        if status_path and filesystem.exists(status_path) then
            local current_status = read_json(status_path)
            if current_status then
                local last_status = last_status_map[app_id] or {}
                
                for ach_id, data in pairs(current_status) do
                    local was_unlocked = last_status[ach_id] and last_status[ach_id].unlocked or false
                    local is_unlocked = data.unlocked or false
                    
                    if is_unlocked and not was_unlocked then
                        print("GSE Achievements: Achievement earned! " .. app_id .. " - " .. ach_id)
                        
                        -- Fetch name from interface file
                        local interface_path = config.interface_path
                        local display_name = ach_id
                        local description = ""
                        local icon = ""
                        
                        local achievements_meta = read_json(interface_path)
                        if achievements_meta then
                            for _, ach in ipairs(achievements_meta) do
                                if ach.name == ach_id then
                                    display_name = ach.display_name or ach_id
                                    description = ach.description or ""
                                    -- Relative icon path
                                    if ach.icon then
                                        local base_dir = interface_path:match("(.*[\\/])")
                                        icon = base_dir .. "img/" .. ach.icon
                                    end
                                    break
                                end
                            end
                        end
                        
                        -- Notify frontend
                        -- Millennium.emit is the likely Lua equivalent
                        if Millennium and Millennium.emit then
                            Millennium.emit("achievement_earned", {
                                app_id = app_id,
                                ach_id = ach_id,
                                name = display_name,
                                description = description,
                                icon = icon
                            })
                        end
                    end
                end
                last_status_map[app_id] = current_status
            end
        end
    end
end

-- API called from frontend
function get_game_config(payload)
    local app_id = tostring(payload.app_id)
    return configs[app_id] or {}
end

function save_game_config(payload)
    local app_id = tostring(payload.app_id)
    configs[app_id] = {
        interface_path = payload.interface_path,
        status_path = payload.status_path
    }
    save_json(settings_path, configs)
    -- Refresh the last status for this game immediately
    local status = read_json(payload.status_path)
    if status then last_status_map[app_id] = status end
    
    return { success = true }
end

function get_achievements(payload)
    local app_id = tostring(payload.app_id)
    local config = configs[app_id]
    if not config then return {} end
    
    local meta = read_json(config.interface_path) or {}
    local status = read_json(config.status_path) or {}
    
    for _, ach in ipairs(meta) do
        local ach_status = status[ach.name] or {}
        ach.unlocked = ach_status.unlocked or false
        ach.unlock_time = ach_status.unlock_time or 0
        
        -- Resolve icon path
        if ach.icon then
            local base_dir = config.interface_path:match("(.*[\\/])")
            ach.icon_path = base_dir .. "img/" .. ach.icon
        end
        if ach.icongray then
            local base_dir = config.interface_path:match("(.*[\\/])")
            ach.icongray_path = base_dir .. "img/" .. ach.icongray
        end
    end
    
    return meta
end

-- Initialize plugin
function _load()
    print("GSE Achievements: Lua Backend Loading...")
    load_configs()
    
    -- Populate initial status map to avoid notifications for already earned achievements
    for app_id, config in pairs(configs) do
        local status = read_json(config.status_path)
        if status then last_status_map[app_id] = status end
    end
    
    -- Start polling for achievements
    if Steam and Steam.SetInterval then
        Steam.SetInterval(3000, check_achievements)
        print("GSE Achievements: Polling interval set.")
    else
        print("GSE Achievements ERROR: Steam.SetInterval not available!")
    end
end

function _unload()
    print("GSE Achievements: Lua Backend Unloading.")
end
