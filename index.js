const assert = require('assert');

const Node = {
  child: require('child_process'),
  fs: require('fs'),
  os: require('os'),
  path: require('path'),
  process: process
};

const Waterfall = {};

Waterfall.chart = function(buffer, options = {}) {
  var self = this;
  // Copy options object to avoid mutating by reference:
  options = JSON.parse(JSON.stringify(options));
  if (!options.name) options.name = 'waterfall-' + Date.now();
  if (!options.unit) options.unit = 'ms';
  const events = self.events(buffer, options);
  const html = self.html(events, options);
  // Width and height depend on the CSS, borders, number of rows, and summary:
  const width = 1280;
  const height = 2 + (events.length * 20) + (20 + 5);
  const png = self.png(html, width, height, options);
  return png;
};

Waterfall.events = function(buffer, options) {
  var self = this;
  var string = buffer.toString('utf-8');
  if (string[0] === '[') {
    // Parse JSON array of events.
    var events = JSON.parse(string);
  } else {
    // Split lines and parse JSON events.
    var events = [];
    string.split('\n').forEach(
      function(line) {
        line = line.trim();
        if (!line) return;
        try {
          events.push(JSON.parse(line));
        } catch (error) {
          throw new Error(error.message + ': ' + JSON.stringify(line));
        }
      }
    );
  }
  events.forEach(
    function(event) {
      try {
        if (!Number.isInteger(event.start) || event.start < 0) {
          throw new Error('event.start is not a positive integer');
        }
        if (!Number.isInteger(event.end) || event.end < 0) {
          throw new Error('event.end is not a positive integer');
        }
        if (event.end < event.start) {
          throw new Error('event.end preceeds event.start');
        }
        if (typeof event.label !== 'string') {
          throw new Error('event.label is not a string');
        }
        if (event.label.trim().length === 0) {
          throw new Error('event.label is an empty string');
        }
      } catch (error) {
        throw new Error(error.message + ': ' + JSON.stringify(event));
      }
    }
  );
  // TODO: Add an option to match or exclude label prefixes.
  // This is useful when you only want to see certain events.
  events.sort(
    function(a, b) {
      if (a.start < b.start) return -1;
      if (b.start < a.start) return 1;
      // Given the same start timestamp, we then want the longest event first:
      // This is critical for calculating causal sums correctly.
      if (a.end > b.end) return -1;
      if (b.end > a.end) return 1;
      if (a.label < b.label) return -1;
      if (b.label < a.label) return 1;
      return 0;
    }
  );
  return events;
};

Waterfall.escapeHTML = function(string) {
  assert(typeof string === 'string');
  string = string.replace(/[^a-zA-Z0-9. -]+/g, ' ');
  string = string.replace(/\s+/g, ' ');
  string = string.trim();
  return string;
};

Waterfall.escapeShell = function(string) {
  assert(typeof string === 'string');
  string = string.replace(/[^a-zA-Z0-9. -]+/g, ' ');
  string = string.replace(/\s+/g, ' ');
  string = string.trim();
  // Replace leading hyphens which are disastrous in the shell:
  string = string.replace(/^-+/g, '');
  return string;
};

Waterfall.html = function(events, options) {
  var self = this;
  const width = 820;
  const epoch = events.length ? events[0].start : 0;
  const range = events.length ? self.maxTimestamp(events) - epoch : 0;
  var rows = '';
  var count = 0;
  var right = 0;
  var sum = 0;
  events.forEach(
    function(event) {
      var labelEscaped = self.escapeHTML(event.label);
      // Match an event label against a label prefix:
      function match(prefix) {
        var normalizedLabel = labelEscaped.toLowerCase().trim();
        var normalizedPrefix = self.escapeHTML(prefix.toLowerCase().trim());
        return normalizedLabel.indexOf(normalizedPrefix) === 0;
      }
      // Decide on the bar color for this event:
      // TODO: Auto-detect label prefixes using colon and use the same
      // Hue-Saturation with changing Lightness for different label prefixes.
      // For example: These are "watery" colors with the same Hue-Saturation:
      // #67abff
      // #338fff
      // #c8e1ff
      var barcolor = '#67abff';
      options.barcolor.some(
        function(value) {
          if (/:/.test(value)) {
            var parts = value.split(':');
            var prefix = parts[0].replace(/^"|"$/);
            if (match(prefix)) {
              barcolor = parts[1];
              return true;
            } else {
              return false;
            }
          } else {
            barcolor = value;
            return false;
          }
        }
      );
      if (/^#[a-f0-9]{1,6}$/i.test(barcolor)) {
        var barcolorEscaped = barcolor;
      } else {
        var barcolorEscaped = self.escapeHTML(barcolor);
      }
      if (!/^(#[a-f0-9]{1,6}|[a-z]+)$/i.test(barcolorEscaped)) {
        throw new Error('bad bar color: ' + JSON.stringify(options.barcolor));
      }
      // Decide whether event should be counted in causal sum:
      var exclude = options.exclude.some(
        function(prefix) {
          return match(prefix);
        }
      );
      var elapsed = event.end - event.start;
      var widthGap = Math.round((event.start - epoch) / range * width);
      var widthBar = Math.max(Math.round(elapsed / range * width), 1);
      var row = self.HTML_ROW;
      row = row.replace('{LABEL}', labelEscaped);
      row = row.replace('{GAP}', self.escapeHTML(widthGap.toString()));
      row = row.replace('{BAR}', self.escapeHTML(widthBar.toString()));
      row = row.replace('{BAR_COLOR}', barcolorEscaped);
      row = row.replace(
        '{ELAPSED}',
        self.escapeHTML(elapsed.toString() + ' ' + options.unit)
      );
      rows += row;
      if (!exclude) {
        if (event.end > right) {
          sum += event.end - Math.max(right, event.start);
          right = event.end;
        }
        count++;
      }
    }
  );
  var html = self.HTML_CHART;
  html = html.replace('{SUMMARY}',
    '<div class="summary">' +
    self.escapeHTML(count + ' Event' + (count == 1 ? '' : 's')) + ' / ' +
    self.escapeHTML(sum + ' ' + options.unit + ' Sum') + ' / ' +
    self.escapeHTML(range + ' ' + options.unit + ' Total') +
    '</div>'
  );
  html = html.replace('{ROWS}', rows);
  return html;
};

Waterfall.maxTimestamp = function(events) {
  var self = this;
  var max = 0;
  events.forEach(
    function(event, index) {
      assert(event.end >= event.start);
      assert(typeof event.label === 'string');
      if (index > 0) {
        var previous = events[index - 1];
        if (previous.start === event.start) {
          assert(previous.end >= event.end);
        } else {
          assert(previous.start < event.start);
        }
      }
      if (event.end > max) max = event.end;
    }
  );
  return max;
};

Waterfall.png = function(html, width, height, options) {
  var self = this;
  var chrome = self.CHROME_PATH();
  if (!chrome) throw new Error('platform not supported');
  var nameEscaped = self.escapeShell(options.name) || 'waterfall';
  // TODO: Change cwd of chrome process so we can avoid Windows escaping issues.
  // This can happen where os.tmpdir contains Windows special characters (&).
  var tmpdir = Node.os.tmpdir();
  var path = {
    html: Node.path.join(tmpdir, nameEscaped + '.html'),
    png: Node.path.join(tmpdir, nameEscaped + '.png')
  };
  assert(Number.isInteger(width) && width > 0);
  assert(Number.isInteger(height) && height > 0);
  var widthEscaped = self.escapeShell(width.toString());
  var heightEscaped = self.escapeShell(height.toString());
  assert(typeof chrome === 'string');
  // We need to use double quotes ourselves for escaping any special characters:
  assert(!/"/.test(chrome));
  assert(!/"/.test(path.html));
  assert(!/"/.test(path.png));
  var args = [
    '--headless',
    '--hide-scrollbars',
    '--window-size=' + widthEscaped + ',' + heightEscaped,
    '--screenshot="' + path.png + '"',
    '"' + path.html + '"'
  ];
  Node.fs.writeFileSync(path.html, html, 'utf-8');
  Node.child.execSync('"' + chrome + '" ' + args.join(' '), {
    cwd: Node.process.cwd(),
    stdio: ['inherit', 'inherit', 'ignore']
  });
  var png = Node.fs.readFileSync(path.png);
  Node.fs.unlinkSync(path.html);
  Node.fs.unlinkSync(path.png);
  return png;
};

Waterfall.CHROME_PATH = function() {
  if (Node.process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  } else if (Node.process.platform === 'win32') {
    // TODO
  } else if (Node.process.platform === 'linux') {
    // TODO
  }
};

Waterfall.HTML_CHART = `<html>
  <head>
    <title>Waterfall</title>
    <style>
      * {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        padding: 0;
      }
      .waterfall {
        border: 1px solid #DDD;
        width: 1280px;
      }
      .row {
        align-items: center;
        color: #444;
        display: flex;
        flex-direction: row;
        font: 12px Helvetica;
        height: 20px;
        letter-spacing: 0px;
        overflow: hidden;
        width: 100%;
      }
      .row:nth-child(even) {
        background: #F8F8F8;
      }
      .label {
        flex: none;
        padding: 0px 5px 0px 5px;
        width: 400px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .gap {
        border-left: 1px solid #DDD;
        flex: none;
        height: 100%;
      }
      .bar {
        flex: none;
        height: 20px;
      }
      .elapsed {
        flex: none;
        padding-left: 5px;
      }
      .summary {
        color: #444;
        font: 12px Helvetica;
        font-weight: 300;
        height: 20px;
        padding: 5px 5px 0px 0px;
        text-align: right;
        width: 1280px;
      }
    </style>
  </head>
  <body>
    <div class="waterfall">{ROWS}
    </div>
    {SUMMARY}
  </body>
</html>
`;

Waterfall.HTML_ROW = `
      <div class="row">
        <div class="label">{LABEL}</div>
        <div class="gap" style="width:{GAP}px"></div>
        <div class="bar" style="width:{BAR}px;background:{BAR_COLOR}"></div>
        <div class="elapsed">{ELAPSED}</div>
      </div>`;

module.exports = Waterfall;
