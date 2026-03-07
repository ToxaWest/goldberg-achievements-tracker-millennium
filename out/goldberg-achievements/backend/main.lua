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

-- Robust JSON payload handler
local function get_payload(payload)
    print("GSE DEBUG: Payload type is " .. type(payload))
    if type(payload) == "string" then
        print("GSE DEBUG: Decoding JSON payload...")
        local decoded = safe_decode(payload)
        if type(decoded) == "table" then return decoded end
    end
    if type(payload) == "table" then return payload end
    return {}
end

-- Exposed Methods
function get_game_config(payload)
    local p = get_payload(payload)
    local id = tostring(p.app_id or "nil")
    print("GSE: get_game_config for " .. id)
    return json.encode(configs[id] or {})
end

function save_game_config(payload)
    local p = get_payload(payload)
    local id = tostring(p.app_id or "")
    print("GSE: save_game_config for " .. id)
    
    if id == "" then return json.encode({ success = false, error = "Backend Error: Missing AppID" }) end

    configs[id] = { 
        interface_path = p.interface_path or "", 
        status_path = p.status_path or "" 
    }
    
    local ok = safe_write_file(settings_path, json.encode(configs))
    
    -- Cache status
    local status_data = safe_decode(safe_read_file(p.status_path))
    if status_data then last_status_map[id] = status_data end
    
    return json.encode({ success = ok })
end

function get_achievements(payload)
    local p = get_payload(payload)
    local id = tostring(p.app_id or "nil")
    print("GSE: get_achievements for " .. id)
    
    local cfg = configs[id]
    if not cfg then return json.encode({}) end
    
    local meta = safe_decode(safe_read_file(cfg.interface_path)) or {}
    local status = safe_decode(safe_read_file(cfg.status_path)) or {}
    local base_dir = cfg.interface_path:match("(.*[/\\])") or ""
    
    local res = {}
    for _, ach in ipairs(meta) do
        if type(ach) == "table" and ach.name then
            local s = status[ach.name] or {}
            local is_unlocked = s.earned == true or s.earned == 1 or s.earned == "true"
            local icon_rel = is_unlocked and (ach.icon or ach.icongray) or (ach.icongray or ach.icon)
            
            table.insert(res, {
                name = ach.name,
                display_name = ach.displayName or ach.name,
                description = ach.description or "",
                unlocked = is_unlocked,
                icon = (icon_rel and icon_rel ~= "") and (base_dir .. icon_rel) or ""
            })
        end
    end
    return json.encode(res)
end

-- Lifecycle
local function on_load()
    print("GSE Achievements Backend Loading")
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
