//
// pixelTests(fixture) will render various
// React-PIXI components, capture the rendered canvas pixels, and return
// the pixels as byte data.
//

function drawTestRenders(mountpoint, testimages) {
  var React = require('react');
  React.PIXI = require('react-pixi');

  var halfanchor = new PIXI.Point(0.5,0.5);

  var SpriteTestComponent = React.createClass({
    displayName:'SpriteTextComponent',
    render: function () {
      return React.PIXI.Stage(
        // props
        {width:200,height:200, backgroundcolor:0x66ff88, ref:'stage'},
        // children
        [
          React.PIXI.Sprite(this.props.spriteprops)
        ]);
    }
  });

  var reactinstance = React.renderComponent(SpriteTestComponent({spriteprops:{x:100,y:100, anchor:halfanchor, image:testimages[0]}}), mountpoint);

  // now make multiple renders with slightly different sprite props. For each set of sprite props
  // we record a snapshot. These snapshots are compared with the known 'good' versions.

  var spritetestprops = [
    { x:100, y:100, anchor:halfanchor, image:testimages[0]},
    { x:110, y:110, anchor:halfanchor, image:testimages[0]},
    { x:100, y:100, anchor: new PIXI.Point(0,0), image:testimages[0]},
    { x:100, y:100, anchor:halfanchor, rotation:90, image:testimages[0]},
    { x:100, y:100, anchor:halfanchor, scale: 2, image:testimages[0]}
  ];

  var renderresults = [];

  spritetestprops.forEach(function (curprops) {
    reactinstance.setProps({spriteprops:curprops});

    // convert the rendered image to a data blob we can use
    var renderer = reactinstance.refs['stage'].pixirenderer;
    var renderURL = renderer.view.toDataURL('image/png');

    // split into two parts; the base64 header and the actual data.  we just want the data
    var renderURLbits = renderURL.split(',');

    renderresults.push(window.atob(renderURLbits[1]));
  });

  React.unmountComponentAtNode(mountpoint);

  return renderresults;
}

function pixelTests(fixture) {
  var testimagepath = './';
  var testimages =
      [
        testimagepath + 'testsprite.png'
      ];

  // preload the images. If we don't pixi will often render the
  // screen before the sprite image is loaded and then we'll see nothing
  var loader = new PIXI.AssetLoader(testimages);

  loader.on('onComplete', function() {
    var results = drawTestRenders(fixture, testimages);
    if (typeof window.callPhantom === 'function') {
      window.callPhantom(results);
    }
  });
  loader.load();
}