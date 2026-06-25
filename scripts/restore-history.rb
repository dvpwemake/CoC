#!/usr/bin/env ruby
# frozen_string_literal: true

require 'json'
require 'net/http'
require 'uri'
require 'openssl'

ROOT = File.expand_path('..', __dir__)
INDEX_PATH = File.join(ROOT, 'index.html')
HISTORY_URL = 'https://raw.githubusercontent.com/dvpwemake/CoC/bdb4d164e1e6c88d8e158f0eebc4145652b32e79/index.html'
UA = 'Mozilla/5.0 (compatible; ChronicleOfConvergence/2.0; +https://chronicleofconvergence.com)'
BAD_IMG_RE = /unsplash\.com|placeholder|photo-xxx|picsum|loremflickr|logo-rss|favicon/i
OG_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i
].freeze

def strip_html(str)
  str.to_s.gsub(/<[^>]*>/, ' ').gsub(/\s+/, ' ').strip
end

def needs_image_fix?(url)
  url.to_s.strip.empty? || BAD_IMG_RE.match?(url)
end

def parse_og_image(html)
  OG_PATTERNS.each do |pat|
    m = html.match(pat)
    next unless m
    img = m[1].gsub('&amp;', '&').strip
    return img unless BAD_IMG_RE.match?(img)
  end
  ''
end

def fetch_text(url, timeout: 15)
  uri = URI(url)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = uri.scheme == 'https'
  http.open_timeout = timeout
  http.read_timeout = timeout
  http.verify_mode = OpenSSL::SSL::VERIFY_PEER
  req = Net::HTTP::Get.new(uri)
  req['User-Agent'] = UA
  req['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  res = http.request(req)
  return '' unless res.is_a?(Net::HTTPSuccess)
  res.body
rescue StandardError
  ''
end

def fetch_og_image(url)
  return '' if url.to_s.strip.empty? || url == '#'

  html = fetch_text(url)
  return parse_og_image(html) unless html.empty?

  proxy = "https://api.allorigins.win/raw?url=#{URI.encode_www_form_component(url)}"
  html = fetch_text(proxy, timeout: 20)
  parse_og_image(html)
end

def extract_embedded_data(html)
  start = html.index('const EMBEDDED_DATA = ')
  raise 'EMBEDDED_DATA not found' unless start

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
  JSON.parse(sub[0..end_idx])
end

def normalize_batch(batch)
  batch = batch.dup
  batch['batchId'] ||= batch['id']
  batch.delete('id')
  batch['items'] = (batch['items'] || []).map do |item|
    item = item.dup
    item['summary'] = strip_html(item['summary'])
    item['image'] = item['image'].to_s.strip
    item
  end
  batch
end

def dedupe_batches(batches)
  seen = {}
  batches.sort_by { |b| b['scannedAt'].to_s }.reverse.select do |b|
    key = b['batchId']
    next false if seen[key]
    seen[key] = true
    true
  end
end

puts 'Downloading historical index.html from GitHub…'
history_html = fetch_text(HISTORY_URL, timeout: 30)
raise 'Failed to download historical data' if history_html.empty?

history = extract_embedded_data(history_html).map { |b| normalize_batch(b) }
current_html = File.read(INDEX_PATH)
current = extract_embedded_data(current_html).map { |b| normalize_batch(b) }

merged = dedupe_batches(history + current)
puts "Merged #{merged.length} batches (#{history.length} historical + #{current.length} current)"

needs_fix = []
merged.each do |batch|
  batch['items'].each do |item|
    needs_fix << item if needs_image_fix?(item['image']) && !item['sourceUrl'].to_s.strip.empty?
  end
end
puts "Fetching #{needs_fix.length} article images…"

needs_fix.each_with_index do |item, i|
  img = fetch_og_image(item['sourceUrl'])
  if !img.empty?
    item['image'] = img
    print '.'
  else
    print 'x'
  end
  sleep 0.15 if (i % 10).zero?
end
puts

filled = merged.sum { |b| b['items'].count { |it| !needs_image_fix?(it['image']) } }
total = merged.sum { |b| b['items'].length }
puts "Images linked: #{filled}/#{total}"

replacement = "const EMBEDDED_DATA = #{JSON.pretty_generate(merged)};"
updated = current_html.sub(/const\s+EMBEDDED_DATA\s*=\s*\[[\s\S]*\];/, replacement)
File.write(INDEX_PATH, updated)
puts "Updated #{INDEX_PATH}"