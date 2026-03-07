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

-- Optimized Base64 Encoder
local function base64_encode(data)
    local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    return ((data:gsub('.', function(x) 
        local r,b='',x:byte()
        for i=8,1,-1 do r=r..(b%2^i-b%2^(i-1)>0 and '1' or '0') end
        return r;
    end)..'0000'):gsub('%d%d%d?%d?%d?%d?', function(x)
        if (#x < 6) then return '' end
        local c=0
        for i=1,6 do c=c+(x:sub(i,i)=='1' and 2^(6-i) or 0) end
        return b:sub(c+1,c+1)
    end)..({ '', '==', '=' })[#data%3+1])
end

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

-- UNIVERSAL ARGUMENT EXTRACTOR
local function get_payload(...)
    local args = {...}
    for i, v in ipairs(args) do
        if type(v) == "table" and (v.app_id or v[1]) then return v end
        if type(v) == "string" then
            local decoded = safe_decode(v)
            if type(decoded) == "table" and decoded.app_id then return decoded end
            if v:match("^%d+$") then return { app_id = v, interface_path = args[i+1], status_path = args[i+2] } end
        end
    end
    return {}
end

-- Exposed Methods
function get_game_config(...)
    local p = get_payload(...)
    local id = tostring(p.app_id or "nil")
    print("GSE: get_game_config for " .. id)
    return json.encode(configs[id] or {})
end

function save_game_config(...)
    local p = get_payload(...)
    local id = tostring(p.app_id or "")
    print("GSE: save_game_config for " .. id)
    
    if id == "" then return json.encode({ success = false, error = "No AppID detected" }) end

    configs[id] = { interface_path = p.interface_path, status_path = p.status_path }
    local ok = safe_write_file(settings_path, json.encode(configs))
    
    local status_data = safe_decode(safe_read_file(p.status_path))
    if status_data then last_status_map[id] = status_data end
    
    return json.encode({ success = ok })
end

function get_achievements(...)
    local p = get_payload(...)
    local id = p.app_id
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
                -- Send the path, not the data, to prevent crash
                icon_path = (icon_rel and icon_rel ~= "" and base_dir ~= "") and (base_dir .. icon_rel) or ""
            })
        end
    end
    return json.encode(res)
end

-- NEW: On-demand icon loading to prevent large payload crash
function get_icon_base64(path)
    if not path or path == "" then return "" end
    local raw = safe_read_file(path)
    if not raw then return "" end
    
    print("GSE: Encoding icon " .. path)
    return "data:image/jpeg;base64," .. base64_encode(raw)
end

-- Lifecycle
local function on_load()
    print("GSE Backend Loaded")
    local content = safe_read_file(settings_path)
    if content then configs = safe_decode(content) or {} end
    millennium.ready()
end

return {
    on_load = on_load,
    on_frontend_loaded = function() print("GSE: Frontend Connected") end,
    get_game_config = get_game_config,
    save_game_config = save_game_config,
    get_achievements = get_achievements,
    get_icon_base64 = get_icon_base64
}
