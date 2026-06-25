#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'

INDEX_PATH = File.expand_path('../index.html', __dir__)

PATCHES = {
  'NASA Announces Artemis III Crew for Critical Moon Mission Testing' => {
    'image' => 'https://www.nasa.gov/wp-content/uploads/2022/11/52508358665_efb8a65d31_o.jpg',
    'sourceUrl' => 'https://www.nasa.gov/missions/artemis/artemis-iii/'
  },
  'Scientists Reverse Anxiety by Fixing Tiny Brain Circuit in Breakthrough Study' => {
    'image' => 'https://www.sciencedaily.com/images/1920/brain-scan-color-black-and-white.webp'
  },
  'Scientists Discover Colossal Fan-Shaped Structure Hidden Beneath Antarctica' => {
    'image' => 'https://www.sciencedaily.com/images/1920/exoplanet-wasp-121-b-artists-impression.webp',
    'sourceUrl' => 'https://scitechdaily.com/scientists-discover-colossal-hidden-structure-beneath-antarctica/'
  },
  'MIT Develops Chip Cooling Technology Using AI While Studying Fake News' => {
    'image' => 'https://www.statnews.com/wp-content/uploads/2026/04/AdobeStock_573445441-1024x576.jpeg',
    'sourceUrl' => 'https://news.mit.edu/topic/artificial-intelligence2'
  },
  "NASA's X-59 Supersonic Jet Breaks Sound Barrier for First Time" => {
    'image' => 'https://www.nasa.gov/wp-content/uploads/2026/06/x59-first-supersonic-flight-m-1-077-clean-high.jpg',
    'sourceUrl' => 'https://www.nasa.gov/aeronautics/x-59-first-supersonic-flight/'
  },
  "NASA's X-59 Jet Breaks Sound Barrier for First Time" => {
    'image' => 'https://www.nasa.gov/wp-content/uploads/2026/06/x59-first-supersonic-flight-m-1-077-clean-high.jpg',
    'sourceUrl' => 'https://www.nasa.gov/aeronautics/x-59-first-supersonic-flight/'
  },
  "NASA's X-59 Jet Breaks Sound Barrier for First Time, Reaching Mach 1.1 in Supersonic Flight Test" => {
    'image' => 'https://www.nasa.gov/wp-content/uploads/2026/06/x59-first-supersonic-flight-m-1-077-clean-high.jpg',
    'sourceUrl' => 'https://www.nasa.gov/aeronautics/x-59-first-supersonic-flight/'
  },
  'Gates-Backed Commonwealth Fusion Validates Physics for Commercial Power Plant' => {
    'image' => 'https://www.sciencedaily.com/images/1920/bessy-ii-superconducting-tes-array-x-ray-spectrometer.webp'
  },
  "South Korea's KSTAR Reactor Achieves 102-Second Fusion Milestone" => {
    'image' => 'https://www.sciencedaily.com/images/1920/bessy-ii-superconducting-tes-array-x-ray-spectrometer.webp'
  }
}.freeze

html = File.read(INDEX_PATH)
start = html.index('const EMBEDDED_DATA = ')
sub = html[start + 'const EMBEDDED_DATA = '.length..]
depth = 0
end_idx = nil
sub.each_char.with_index do |ch, i|
  if ch == '['
    depth += 1
  elsif ch == ']'
    depth -= 1
    if depth.zero?
      end_idx = i
      break
    end
  end
end
data = JSON.parse(sub[0..end_idx])

patched = 0
data.each do |batch|
  batch['items'].each do |item|
    patch = PATCHES[item['title']]
    next unless patch

    patch.each { |k, v| item[k] = v }
    patched += 1
  end
end

replacement = "const EMBEDDED_DATA = #{JSON.pretty_generate(data)};"
File.write(INDEX_PATH, html.sub(/const\s+EMBEDDED_DATA\s*=\s*\[[\s\S]*\];/, replacement))
puts "Patched #{patched} items"