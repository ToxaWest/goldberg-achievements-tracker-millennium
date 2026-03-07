local millennium = require("millennium")
local json = require("json")

-- Resolve absolute path safely
local function get_plugin_dir()
    local path = "."
    if millennium.get_install_path then path = millennium.get_install_path() end
    return path:gsub("\\", "/"):gsub("/$", "")
end

local settings_path = get_plugin_dir() .. "/settings.json"
local configs = {}

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

-- Extremely Robust Argument Parser
local function get_payload(a1, a2, a3)
    -- Case 1: Single table payload
    if type(a1) == "table" then 
        return {
            app_id = tostring(a1.app_id or a1[1] or ""),
            interface_path = a1.interface_path or a1[2] or "",
            status_path = a1.status_path or a1[3] or ""
        }
    end
    
    -- Case 2: Stringified JSON payload
    if type(a1) == "string" and (a1:sub(1,1) == "{" or a1:sub(1,1) == "[") then
        local decoded = safe_decode(a1)
        if type(decoded) == "table" then 
            return {
                app_id = tostring(decoded.app_id or decoded[1] or ""),
                interface_path = decoded.interface_path or decoded[2] or "",
                status_path = decoded.status_path or decoded[3] or ""
            }
        end
    end

    -- Case 3: Positional arguments
    return {
        app_id = tostring(a1 or ""),
        interface_path = tostring(a2 or ""),
        status_path = tostring(a3 or "")
    }
end

-- Exposed Methods
function get_game_config(a1, a2, a3)
    local p = get_payload(a1, a2, a3)
    print("GSE: get_game_config for " .. p.app_id)
    return json.encode(configs[p.app_id] or {})
end

function save_game_config(a1, a2, a3)
    local p = get_payload(a1, a2, a3)
    print("GSE: save_game_config for " .. p.app_id)
    
    if p.app_id == "" or p.app_id == "nil" then 
        return json.encode({ success = false, error = "No AppID detected in payload" }) 
    end

    configs[p.app_id] = { 
        interface_path = p.interface_path, 
        status_path = p.status_path 
    }
    
    local ok = safe_write_file(settings_path, json.encode(configs))
    return json.encode({ success = ok })
end

function get_achievements(a1, a2, a3)
    local p = get_payload(a1, a2, a3)
    print("GSE: get_achievements for " .. p.app_id)
    
    local cfg = configs[p.app_id]
    if not cfg then return json.encode({}) end
    
    local meta = safe_decode(safe_read_file(cfg.interface_path)) or {}
    local status = safe_decode(safe_read_file(cfg.status_path)) or {}
    
    local res = {}
    for _, ach in ipairs(meta) do
        if type(ach) == "table" and ach.name then
            local s = status[ach.name] or {}
            table.insert(res, {
                name = ach.name,
                display_name = ach.display_name or ach.name,
                unlocked = s.unlocked or false
            })
        end
    end
    return json.encode(res)
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
    get_game_config = get_game_config,
    save_game_config = save_game_config,
    get_achievements = get_achievements
}
