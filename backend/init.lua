local millennium = require("millennium")
local fs = require("filesystem")
local json = require("cjson")

local settings_path = "settings.json"
local configs = {}
local last_status_map = {}

-- Utility to read and parse JSON using framework modules
local function read_json(path)
    if not fs.exists(path) then return nil end
    local content = fs.read_file(path)
    if not content then return nil end
    local status, data = pcall(json.decode, content)
    return status and data or nil
end

-- Utility to save JSON using framework modules
local function save_json(path, data)
    local status, content = pcall(json.encode, data)
    if not status then return false end
    return fs.write_file(path, content)
end

-- Achievement check logic
local function check_achievements()
    for app_id, config in pairs(configs) do
        local status_path = config.status_path
        if status_path and fs.exists(status_path) then
            local current_status = read_json(status_path)
            if current_status then
                local last_status = last_status_map[app_id] or {}
                for ach_id, data in pairs(current_status) do
                    local was_unlocked = last_status[ach_id] and last_status[ach_id].unlocked
                    local is_unlocked = data.unlocked
                    
                    if is_unlocked and not was_unlocked then
                        print("GSE Achievements: Achievement earned! " .. app_id .. " - " .. ach_id)
                        
                        local display_name = ach_id
                        local description = ""
                        local icon = ""
                        
                        local meta = read_json(config.interface_path)
                        if meta then
                            for _, ach in ipairs(meta) do
                                if ach.name == ach_id then
                                    display_name = ach.display_name or ach_id
                                    description = ach.description or ""
                                    if ach.icon then
                                        local base_dir = config.interface_path:match("(.*[\\/])") or ""
                                        icon = base_dir .. "img/" .. ach.icon
                                    end
                                    break
                                end
                            end
                        end
                        
                        millennium.emit("achievement_earned", {
                            app_id = app_id, ach_id = ach_id, name = display_name, description = description, icon = icon
                        })
                    end
                end
                last_status_map[app_id] = current_status
            end
        end
    end
end

-- Exported functions
local function get_game_config(payload)
    local app_id = tostring(payload.app_id)
    return configs[app_id] or {}
end

local function save_game_config(payload)
    local app_id = tostring(payload.app_id)
    configs[app_id] = { interface_path = payload.interface_path, status_path = payload.status_path }
    
    local success = save_json(settings_path, configs)
    
    local status = read_json(payload.status_path)
    if status then last_status_map[app_id] = status end
    return { success = success }
end

local function get_achievements(payload)
    local app_id = tostring(payload.app_id)
    local config = configs[app_id]
    if not config then return {} end
    
    local meta = read_json(config.interface_path) or {}
    local status = read_json(config.status_path) or {}
    
    for _, ach in ipairs(meta) do
        local ach_status = status[ach.name] or {}
        ach.unlocked = ach_status.unlocked or false
        ach.unlock_time = ach_status.unlock_time or 0
        local base_dir = config.interface_path:match("(.*[\\/])") or ""
        if ach.icon then ach.icon_path = base_dir .. "img/" .. ach.icon end
        if ach.icongray then ach.icongray_path = base_dir .. "img/" .. ach.icongray end
    end
    return meta
end

-- Lifecycle
local function on_load()
    local pstatus, err = pcall(function()
        print("GSE Achievements: Backend starting...")
        
        local data = read_json(settings_path)
        if data then configs = data end
        
        for app_id, config in pairs(configs) do
            local status_data = read_json(config.status_path)
            if status_data then last_status_map[app_id] = status_data end
        end
        
        if Steam and Steam.SetInterval then
            Steam.SetInterval(3000, check_achievements)
        end
    end)
    
    if not pstatus then print("GSE Achievements ERROR: " .. tostring(err)) end
    
    millennium.ready()
end

return {
    on_load = on_load,
    get_game_config = get_game_config,
    save_game_config = save_game_config,
    get_achievements = get_achievements
}
