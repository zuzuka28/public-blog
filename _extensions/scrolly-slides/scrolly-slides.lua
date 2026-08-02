local dependency_added = false
local instance_count = 0
local prefix = "scrolly-slides-"

local function has_class(el, name)
  for _, class_name in ipairs(el.classes) do
    if class_name == name then
      return true
    end
  end
  return false
end

local function add_class(el, name)
  if not has_class(el, name) then
    table.insert(el.classes, name)
  end
end

local function html_escape(value)
  return tostring(value)
    :gsub("&", "&amp;")
    :gsub('"', "&quot;")
    :gsub("<", "&lt;")
    :gsub(">", "&gt;")
end

local function attribute(el, name, fallback)
  local value = el.attributes[prefix .. name]
  if value == nil then
    return fallback
  end
  return pandoc.utils.stringify(value)
end

local function dimension(value, fallback)
  if value == nil or value == "" then
    return fallback
  end

  value = pandoc.utils.stringify(value)
  local allowed = value:match("^%d+%.?%d*px$")
    or value:match("^%d+%.?%d*rem$")
    or value:match("^%d+%.?%d*em$")
    or value:match("^%d+%.?%d*vh$")
    or value:match("^%d+%.?%d*vw$")
    or value:match("^%d+%.?%d*%%$")

  if allowed then
    return value
  end

  quarto.log.warning("scrolly-slides: ignored unsafe CSS dimension '" .. value .. "'")
  return fallback
end

local function boolean_attribute(value, fallback)
  if value == nil then
    return fallback
  end
  value = pandoc.utils.stringify(value):lower()
  return value ~= "false" and value ~= "0" and value ~= "no"
end

local function reveal_url(deck)
  local base, fragment = deck:match("^(.-)(#.*)$")
  base = base or deck
  fragment = fragment or ""
  local separator = base:find("?", 1, true) and "&" or "?"
  return base
    .. separator
    .. "postMessageEvents=true&mouseWheel=true&scrollActivationWidth=false"
    .. fragment
end

local function error_block(message)
  return pandoc.Div(
    { pandoc.Para({ pandoc.Str(message) }) },
    pandoc.Attr("", { "scrolly-slides__error" })
  )
end

local function add_dependency()
  if dependency_added then
    return
  end
  quarto.doc.add_html_dependency({
    name = "scrolly-slides",
    version = "0.2.0",
    scripts = {
      { path = "scrolly-slides.js", afterBody = true }
    },
    stylesheets = { "scrolly-slides.css" }
  })
  dependency_added = true
end

function Div(el)
  if not has_class(el, "scrolly-slides") then
    return nil
  end

  if not quarto.doc.is_format("html:js") then
    return el
  end

  local deck = attribute(el, "deck")
  if deck == nil or deck == "" then
    quarto.log.error("scrolly-slides: .scrolly-slides requires scrolly-slides-deck=\"...\"")
    return error_block("Scrolly Slides: add scrolly-slides-deck=\"path/to/deck.html\".")
  end

  local mode = attribute(el, "mode", "sticky")
  if mode ~= "sticky" and mode ~= "floating" then
    quarto.log.warning("scrolly-slides: unknown scrolly-slides-mode '" .. mode .. "'; using sticky")
    mode = "sticky"
  end

  local side = attribute(el, "side", "right")
  if side ~= "left" and side ~= "right" then
    quarto.log.warning("scrolly-slides: unknown scrolly-slides-side '" .. side .. "'; using right")
    side = "right"
  end

  local collapsible = boolean_attribute(el.attributes[prefix .. "collapsible"], true)
  local start_hidden = boolean_attribute(el.attributes[prefix .. "start-hidden"], false)
  if start_hidden and not collapsible then
    quarto.log.warning("scrolly-slides: start-hidden requires collapsible=true; showing the deck")
    start_hidden = false
  end

  local step_count = 0
  local article_blocks = {}
  for _, block in ipairs(el.content) do
    if block.t == "Div" and has_class(block, "scrolly-slides-step") then
      step_count = step_count + 1
      add_class(block, "scrolly-slides__step")
      local coordinates = block.attributes[prefix .. "slide"] or tostring(step_count - 1)
      block.attributes["data-scrolly-slides-slide"] = pandoc.utils.stringify(coordinates)
      block.attributes[prefix .. "slide"] = nil
      block.attributes["tabindex"] = "-1"
      block.attributes["aria-label"] = "Story step " .. step_count
      table.insert(article_blocks, block)
    else
      table.insert(article_blocks, block)
    end
  end

  if step_count == 0 then
    quarto.log.warning("scrolly-slides: no direct child .scrolly-slides-step blocks found")
    return el
  end

  add_dependency()
  instance_count = instance_count + 1

  local identifier = el.identifier
  if identifier == nil or identifier == "" then
    identifier = "scrolly-slides-" .. instance_count
  end

  local title = attribute(el, "title", "Synchronized Reveal presentation")
  local controls = boolean_attribute(el.attributes[prefix .. "controls"], true)
  local height = dimension(el.attributes[prefix .. "height"], "clamp(24rem, 36vw, 40rem)")
  local offset = dimension(el.attributes[prefix .. "offset"], "5.5rem")
  local edge_offset = dimension(el.attributes[prefix .. "edge-offset"], "1rem")
  local iframe_src = reveal_url(deck)
  local stage_id = identifier .. "-stage"

  local hide_button = ""
  if collapsible then
    hide_button = string.format([[
    <button class="scrolly-slides__visibility-button scrolly-slides__hide" type="button" data-scrolly-slides-action="hide" aria-controls="%s" aria-expanded="true">Hide slides</button>]], html_escape(stage_id))
  end

  local stage_html = string.format([[
<div class="scrolly-slides__chrome">
  <div class="scrolly-slides__frame-wrap">
    <iframe class="scrolly-slides__frame" src="%s" title="%s" loading="eager" allow="fullscreen" allowfullscreen></iframe>
  </div>
  <div class="scrolly-slides__toolbar" aria-label="Presentation controls">
    <div class="scrolly-slides__progress" aria-hidden="true"><span></span></div>
    <span class="scrolly-slides__count" aria-live="polite">1 / %d</span>
    <div class="scrolly-slides__actions">
      <button class="scrolly-slides__button" type="button" data-scrolly-slides-action="prev" aria-label="Previous slide">&#8592;</button>
      <button class="scrolly-slides__button" type="button" data-scrolly-slides-action="next" aria-label="Next slide">&#8594;</button>
      <a class="scrolly-slides__open" href="%s" target="_blank" rel="noopener" aria-label="Open presentation in a new tab">Open &#8599;</a>
    </div>
  </div>
</div>%s]],
    html_escape(iframe_src),
    html_escape(title),
    step_count,
    html_escape(deck),
    hide_button
  )

  local stage = pandoc.Div(
    { pandoc.RawBlock("html", stage_html) },
    pandoc.Attr(stage_id, { "scrolly-slides__stage" })
  )
  local article = pandoc.Div(
    article_blocks,
    pandoc.Attr("", { "scrolly-slides__article" })
  )

  local root_classes = {}
  for _, class_name in ipairs(el.classes) do
    table.insert(root_classes, class_name)
  end
  table.insert(root_classes, "scrolly-slides--" .. mode)
  table.insert(root_classes, "scrolly-slides--" .. side)
  if not controls then
    table.insert(root_classes, "scrolly-slides--no-controls")
  end
  if not collapsible then
    table.insert(root_classes, "scrolly-slides--not-collapsible")
  end
  if start_hidden then
    table.insert(root_classes, "is-deck-hidden")
  end

  local configuration_attributes = {
    [prefix .. "deck"] = true,
    [prefix .. "mode"] = true,
    [prefix .. "side"] = true,
    [prefix .. "height"] = true,
    [prefix .. "offset"] = true,
    [prefix .. "edge-offset"] = true,
    [prefix .. "title"] = true,
    [prefix .. "controls"] = true,
    [prefix .. "collapsible"] = true,
    [prefix .. "start-hidden"] = true
  }
  local root_attributes = {}
  for name, value in pairs(el.attributes) do
    if not configuration_attributes[name] then
      root_attributes[name] = pandoc.utils.stringify(value)
    end
  end
  root_attributes["data-scrolly-slides-mode"] = mode
  root_attributes["data-scrolly-slides-side"] = side
  root_attributes["data-scrolly-slides-steps"] = tostring(step_count)
  root_attributes["data-scrolly-slides-collapsible"] = tostring(collapsible)
  root_attributes["data-scrolly-slides-hidden"] = tostring(start_hidden)
  root_attributes["aria-label"] = root_attributes["aria-label"] or "Synchronized article and presentation"
  local generated_style = table.concat({
    "--scrolly-slides-stage-height:", height, ";",
    "--scrolly-slides-stage-offset:", offset, ";",
    "--scrolly-slides-edge-offset:", edge_offset, ";"
  })
  if root_attributes["style"] and root_attributes["style"] ~= "" then
    root_attributes["style"] = root_attributes["style"] .. ";" .. generated_style
  else
    root_attributes["style"] = generated_style
  end

  local content = { stage, article }
  if collapsible then
    local restore_html = string.format([[
<button class="scrolly-slides__restore" type="button" data-scrolly-slides-action="show" aria-controls="%s" aria-expanded="false">Show slides</button>]], html_escape(stage_id))
    table.insert(content, pandoc.RawBlock("html", restore_html))
  end

  return pandoc.Div(
    content,
    pandoc.Attr(identifier, root_classes, root_attributes)
  )
end
