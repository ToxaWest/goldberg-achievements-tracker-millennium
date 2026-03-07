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

-- NUCLEAR ARGUMENT PARSER
-- Scans every single argument provided by Millennium to find our data
local function get_args(...)
    local args = {...}
    local res = { app_id = "", interface_path = "", status_path = "" }
    
    print("GSE DEBUG: Parsing " .. #args .. " args")
    
    for i, v in ipairs(args) do
        print("  [" .. i .. "] type: " .. type(v))
        
        -- Case 1: Found a table (the most likely delivery method)
        if type(v) == "table" then
            if v.app_id then
                print("    Found app_id in table: " .. tostring(v.app_id))
                return {
                    app_id = tostring(v.app_id),
                    interface_path = v.interface_path or "",
                    status_path = v.status_path or ""
                }
            end
        end
        
        -- Case 2: Found a JSON string
        if type(v) == "string" and (v:sub(1,1) == "{" or v:sub(1,1) == "[") then
            local decoded = safe_decode(v)
            if type(decoded) == "table" and decoded.app_id then
                print("    Found app_id in decoded JSON: " .. tostring(decoded.app_id))
                return {
                    app_id = tostring(decoded.app_id),
                    interface_path = decoded.interface_path or "",
                    status_path = decoded.status_path or ""
                }
            end
        end
        
        -- Case 3: Found a raw numeric string (AppID)
        if type(v) == "string" and v:match("^%d+$") then
            print("    Found raw AppID string: " .. v)
            res.app_id = v
            -- Look ahead for paths if they exist
            if args[i+1] and type(args[i+1]) == "string" then res.interface_path = args[i+1] end
            if args[i+2] and type(args[i+2]) == "string" then res.status_path = args[i+2] end
            return res
        end
    end
    
    print("GSE DEBUG: No valid AppID found in arguments!")
    return res
end

-- Exposed Methods
function get_game_config(...)
    local p = get_args(...)
    print("GSE: get_game_config for " .. p.app_id)
    return json.encode(configs[p.app_id] or {})
end

function save_game_config(...)
    local p = get_args(...)
    print("GSE: save_game_config for " .. p.app_id)
    
    if p.app_id == "" then return json.encode({ success = false, error = "Backend Error: AppID not found" }) end

    configs[p.app_id] = { 
        interface_path = p.interface_path, 
        status_path = p.status_path 
    }
    
    local ok = safe_write_file(settings_path, json.encode(configs))
    
    -- Load status immediately
    local status_data = safe_decode(safe_read_file(p.status_path))
    if status_data then last_status_map[p.app_id] = status_data end
    
    return json.encode({ success = ok })
end

function get_achievements(...)
    local p = get_args(...)
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
                icon = (icon_rel and icon_rel ~= "") and (base_dir .. icon_rel) or ""
            })
        end
    end
    return json.encode(res)
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
    get_achievements = get_achievements
}
