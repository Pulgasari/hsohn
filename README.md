# hsohn (experimental)

## idea

- native html-tags sind reserviert
- webcomponents-semantik funktioniert vollumfänglich
- man kann custom-tags definieren
- wenn custom-tags nicht definiert wurden, wird daraus `<div>` und der tagname als class
- kurzform `#foo` für id
- kurzform `#-bar` für multi-level combined id

## basic example

```html
<h2>the pieces</h2>
<div class="grid">

  <div class="card">
    <strong>pinchable</strong>
    <div class="pad" id="pinch">pinch me</div>
    <div class="read" id="pinch-read">scale 1.00</div>
  </div>

  <div class="card">
    <strong>rotatable</strong>
    <div class="pad" id="rotate-pad">rotate me</div>
    <div class="read" id="rotate-read">0°</div>
  </div>

  <div class="card">
    <strong>swipeable</strong>
    <div class="pad" id="swipe">swipe me</div>
    <div class="read" id="swipe-read">—</div>
  </div>
</div>
```

```xml
<h2>the pieces</h2>
<grid>
  <card #pinch>
    <strong>pinchable</strong>
    <pad #pinch-pad>pinch me</pad>
    <read #pinch-read>scale 1.00</read>
  </card>

  <card #rotate>
    <strong>rotatable</strong>
    <pad #-pad>rotate me</pad>
    <read #-read>0°</read>
  </card>

  <card #swipe>
    <strong>swipeable</strong>
    <pad #swipe-pad>swipe me</pad>
    <read #swipe-read>—</read>
  </card>
</grid>
```

# tmpl :: spec

- native html-tags work normally
- webcomponents as well
- one could use custom-tags with or without explicitly defining them
- if they weren't specified they simply become a div with a className of the custom-tag-name

## undefined custom-tags

```xml
<box>
  <card>...</card>
  <card>...</card>
</box>
```

an undefined custom tag evaluates to a `<div>` with a className of that tagName.

```xml
<div class='box'>
  <div class='card'>...</div>
  <div class='card'>...</div>
</div>
```

## define custom-tags by shorthand mapping

```html
<tmpl tag='btn'  is='button' />
<tmpl tag='href' is='a'      attr='href' />
<tmpl tag='pic'  is='image'  attr='src'  />
```

```xml
<href 'https://example.com' />
<btn.primary 'click me!' on:click={alert('moin!')} />
<pic 'https://example.tld/sky.jpg' />
```

## define custom-tags by template

refer to an custom-tag-attribute with `$attr`.

```html
<tmpl tag='track'>
  <div class='track'>
    <img src='./$title.jpg' />
    <audio src='./$title.mp3' />
  </div>
</tmpl>
```

```html
<track title='example1' />
<track title='example2' />
```

or use even `$attr`:

```html
<tmpl tag='track'>
  <div class='track'>
    <img src='./$attr.jpg' />
    <audio src='./$attr.mp3' />
  </div>
</tmpl>
```

```html
<track 'example1' />
<track 'example2' />
```


