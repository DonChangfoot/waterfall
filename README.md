# waterfall

Create waterfall charts to show events in causal order.

![An example network waterfall](https://github.com/DonChangfoot/waterfall/blob/master/example.png?raw=true)

## Installation

You can make the `waterfall` CLI script accessible from anywhere in your path:

```
sudo npm install -g waterfall
```

## Usage

```bash
waterfall <data-file>
```

## Data file format

Getting your first waterfall chart up and running is a breeze:

`waterfall` accepts line-separated JSON events or a JSON array of events, where
each event has a start and end [timestamp](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now) and a string label:

```json
{ "start": 1587645957644, "end": 1587645963195, "label": "DNS" }
{ "start": 1587645963195, "end": 1587645968900, "label": "TCP" }
{ "start": 1587645968910, "end": 1587646249816, "label": "TLS" }
```

**That's it!**

There are no dependencies except Chrome, which we use in headless mode to screenshot the HTML chart to a PNG.


### Command line options

You can customize bar colors by default and/or by label prefix:

```bash
waterfall --BAR-COLOR=blue --BAR-COLOR=dns:yellow <data-file>
````

You can also exclude events from the cumulative sum shown at the bottom of the
chart:

```bash
waterfall --EXCLUDE="dns lookup" <data-file>
````

## Acknowledgements

This script was created by [Joran Dirk Greef](https://github.com/jorangreef) and [Donovan Changfoot](https://github.com/DonChangfoot) as part of performance testing work on [Mojaloop](https://mojaloop.io) by [Coil](https://coil.com).
