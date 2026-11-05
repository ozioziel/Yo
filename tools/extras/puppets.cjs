/* Puppet definitions for the extra penguins, in cut-out pixel coordinates
 * (generated/<id>/cutout.png). "L"/"R" are the viewer's left and right.
 *
 * Flippers hanging at the side (`seam`): the whole sleeve with its cuff and flipper is cut
 * along the sleeve's own seam, a polyline from the shoulder line down to the flipper's end
 * (measured on the drawing's ink lines). It turns at the outer shoulder and is drawn behind
 * the torso, which keeps the seam as its outline: a raised flipper opens a real armpit.
 *   hair   hair falling over that sleeve stays in front, with the head
 *   pivot  shoulder joint; by default near the outer end of the shoulder line
 * Flippers holding something in front (`piece`): explicit outline, drawn in front.
 *   extras  bits above the outline that move with it (a straw over the hair)
 *   fills   body areas uncovered when such a piece moves, filled from the garment around
 *           (rows: from the same row only, so a face stays white and a hoodie stays black)
 *   gain    fraction of the commanded raise it follows (signature poses move gently)
 *   both    follows the average of both flippers (an object held with both)
 *   lift    how far it rises (cut-out px) at a 90° raise
 * tip   the flipper's end (hand anchor for carried objects)
 * eyes  eye centre and radii, for blinking / closed / surprised eyes (none behind sunglasses)
 */
module.exports = {
  aylen: {
    armL: { side: -1, tip: [55, 885], seam: [[104, 605], [100, 660], [102, 700], [110, 735], [130, 760], [126, 780], [123, 800], [119, 820], [115, 840], [113, 870], [110, 900], [107, 915], [90, 932], [60, 937]] },
    armR: { side: 1, tip: [720, 945], seam: [[612, 612], [606, 660], [599, 700], [596, 740], [599, 760], [603, 780], [606, 800], [609, 820], [613, 840], [621, 860], [640, 880], [656, 900], [668, 918], [690, 940], [707, 962], [714, 980]] },
    eyes: [{ c: [260, 295], r: [14, 19] }, { c: [439, 299], r: [21, 26] }],
  },
  boris: {
    armL: { side: -1, tip: [50, 900], seam: [[195, 556], [176, 580], [168, 600], [161, 620], [154, 640], [148, 660], [143, 680], [139, 700], [135, 720], [131, 740], [126, 760], [123, 780], [117, 800], [112, 820], [108, 840], [107, 860], [109, 880], [111, 900], [106, 920], [100, 940], [85, 956], [60, 962]] },
    armR: { side: 1, tip: [700, 960], seam: [[540, 590], [530, 620], [525, 650], [527, 680], [531, 700], [536, 720], [541, 740], [547, 760], [554, 780], [562, 800], [572, 820], [571, 840], [573, 860], [590, 880], [601, 900], [614, 920], [628, 940], [645, 962], [662, 985], [680, 1004], [700, 1009]] },
    eyes: [{ c: [231, 301], r: [14, 18] }, { c: [380, 321], r: [19, 22] }],
  },
  chalquits: {
    armL: { side: -1, tip: [50, 950], seam: [[176, 592], [174, 600], [168, 620], [164, 640], [159, 660], [155, 680], [151, 700], [147, 720], [144, 740], [141, 760], [138, 780], [136, 800], [134, 820], [132, 840], [128, 860], [131, 880], [132, 900], [127, 920], [116, 940], [103, 960], [92, 980], [75, 996]] },
    armR: { side: 1, tip: [700, 955], seam: [[632, 588], [621, 600], [614, 620], [610, 640], [608, 660], [609, 680], [612, 700], [615, 720], [620, 740], [624, 760], [623, 780], [624, 800], [630, 820], [630, 840], [626, 860], [632, 880], [639, 900], [637, 920], [651, 940], [648, 960], [654, 980], [664, 998], [690, 1005]] },
    eyes: [{ c: [251, 267], r: [15, 19] }, { c: [414, 274], r: [15, 19] }],
  },
  chiquito: {
    // the laptop and both flippers holding it move together, in front
    // both flippers hold it: it follows the average raise, tilting a little and lifting
    armL: { side: -1, tip: [240, 600], pivot: [300, 470], both: true, gain: 0.12, lift: 70, piece: [[10, 190], [330, 168], [470, 455], [470, 560], [420, 600], [215, 690], [95, 690], [80, 600], [0, 560]] },
    fills: [{ poly: [[150, 200], [470, 200], [470, 700], [150, 700]], rows: true }],
    eyes: [{ c: [417, 299], r: [18, 19] }],
  },
  oror: {
    armL: { side: -1, tip: [45, 900], seam: [[126, 592], [126, 600], [123, 620], [122, 640], [122, 660], [124, 680], [126, 700], [128, 720], [125, 740], [120, 760], [115, 780], [110, 800], [106, 820], [103, 840], [101, 860], [100, 880], [98, 900], [98, 920], [95, 940], [85, 952], [60, 957]] },
    armR: { side: 1, tip: [650, 930], seam: [[534, 612], [534, 620], [530, 640], [528, 660], [528, 680], [530, 700], [533, 720], [537, 740], [541, 760], [546, 780], [552, 800], [558, 820], [570, 840], [573, 860], [582, 880], [593, 900], [600, 920], [611, 940], [629, 960], [650, 978], [670, 985]] },
    eyes: [{ c: [179, 294], r: [14, 19] }, { c: [316, 297], r: [14, 19] }],
  },
  'shadow-frederick': {
    // the raised flipper with the twig turns at the elbow, in front of the shirt
    armL: {
      side: -1, tip: [70, 520], pivot: [190, 650], gain: 0.45,
      piece: [[35, 350], [95, 345], [110, 420], [160, 450], [165, 540], [190, 600], [205, 640], [150, 680], [90, 660], [40, 620], [10, 550], [8, 450]],
    },
    armR: { side: 1, tip: [770, 960], seam: [[650, 575], [628, 620], [618, 660], [610, 700], [600, 730], [594, 760], [600, 790], [606, 810], [612, 830], [618, 850], [628, 870], [636, 895], [660, 930], [690, 960], [700, 985], [722, 1010], [770, 1030]] },
    fills: [{ poly: [[110, 560], [210, 560], [220, 665], [150, 690], [105, 640]] }],
    eyes: [{ c: [467, 320], r: [22, 22] }],
  },
  tats: {
    // the cup, the flipper holding it and the bent sleeve turn together at the shoulder,
    // which is hidden behind the cup; straw and lid overlap the hair
    armL: {
      side: -1, tip: [60, 650], pivot: [178, 600],
      piece: [[148, 430], [184, 430], [188, 488], [252, 494], [254, 862], [130, 868], [60, 850], [20, 800], [4, 700], [8, 600], [36, 572], [92, 556], [100, 494], [146, 488]],
    },
    armR: { side: 1, tip: [705, 950], seam: [[600, 600], [578, 640], [568, 700], [572, 760], [588, 810], [600, 850], [612, 880], [640, 905], [660, 930], [672, 960], [690, 985], [715, 996]] },
    fills: [
      { poly: [[96, 424], [262, 424], [262, 500], [96, 500]] },
      { poly: [[188, 486], [262, 486], [262, 872], [104, 872], [102, 760], [114, 640], [150, 560]], stroke: [[186, 506], [142, 580], [114, 680], [104, 780], [108, 866]] },
    ],
    eyes: [],
  },
  'zorro-negro': {
    // the orange sleeves have no drawn seam: the cut keeps pockets and cream panels on the torso
    armL: { side: -1, tip: [70, 900], seam: [[195, 600], [178, 660], [165, 720], [152, 770], [146, 820], [140, 850], [134, 880], [130, 905], [120, 935], [105, 958], [80, 970]] },
    // starts below the fox hood resting on that shoulder
    armR: { side: 1, tip: [780, 950], seam: [[664, 706], [655, 740], [648, 800], [650, 850], [660, 880], [680, 905], [700, 930], [715, 955], [730, 985], [760, 1006]] },
    eyes: [{ c: [411, 339], r: [21, 24] }],
  },
};
