"""VFX_Yebisu_Guard: one guard reaction on the defender, not a held barrier.

Original Studio Yebisu example written with the effekseer-vfx skill. A thin outline draws itself up a guard disc
beside the defender, a short white star marks the blocked blow, the blue face ripples and erodes, then splits into
six plate pieces and small chips that drift off and are gone by f30.
"""
from vfxkit.primitives import *

# The guard disc stands on the attacker's side (+X) of the defender, yawed like a melee ring that crosses a
# left-to-right blow (engine conventions: tilt (0,58,0) reads as a vertical ellipse), so the dummy stays beside it.
# Inside the plane: Ring angles 0 up, 90 left, counter-clockwise; ring height (the second value) bulges along +Z.
PLANE=[.6,.05,0]
CONTACT=[0,.15,.05]   # where the blow lands, in the plane's local space: chest height, just in front of the face
R=.74                 # face radius against a dummy about 1.75 tall


def _shard(i,centre,outer,dist):
 # A 46° sector of the face (14° gaps between sectors): real geometry gaps, the flat counterpart of shell_fragments.
 a=math.radians(centre); s=-1 if i%2 else 1
 # The compiler writes color_curve only for Sprite/Model; a Ring draws its three fixed vertex colours. So the
 # pieces carry their cooled blue in those colours: a saturated band, dimmer navy edges, below the face's value,
 # and they "cool" only by fading and eroding (no hue animation).
 return dict(name=f'Plate shard {i+1}',renderer='Ring',life=15,delay=13,billboard='Fixed',rotation=[0,0,0],
  ring=dict(vertices=72,outer=[outer,0],inner=[.2,.06],center_ratio=.6,outer_color=[30,70,190,120],center_color=[60,125,255,190],inner_color=[20,45,130,30],
   angle_start=centre-23,angle_end=centre+23),
  # Separate first, then slow; a slight sag and a push toward the attacker side, each piece tumbling its own way.
  travel=dict(end=[-math.sin(a)*dist,math.cos(a)*dist-.06,.08],easing='EaseOutCubic'),spin=[s*.9,-s*1.3,0],
  alpha_texture=tex('T_NoiseTile02'),cutoff=dict(start=.05,end=.85,easing='EaseInQuadratic'),fade_in=1,fade_out=6,emissive=1)


def recipe():
 pale=(200,232,255,235); blue=(150,205,255,190)
 plane=[
  # Anticipation: the outline grows from the bottom up both sides and closes at the top just before the blow lands.
  dict(name='Outline draw',renderer='Ring',color=list(pale),life=7,delay=0,billboard='Fixed',rotation=[0,0,0],
   ring=dict(vertices=96,outer=[R+.05,0],inner=[R-.02,0],center_ratio=.5,outer_color=[255,255,255,0],center_color=[255,255,255,255],inner_color=[255,255,255,0],
    angle_start=[180,0],angle_end=[180,360],angle_easing='EaseOutCubic'),
   size=1,size_curve=[[0,.92],[100,1]],fade_in=0,fade_out=3,emissive=1.6),
  # Body: a shallow convex disc, bright rim and a thin centre so the dummy reads through it; the noise flows round
  # and outward, the disc gives a little under the blow, then erodes into holes. Its blue is the three fixed ring
  # vertex colours (a Ring takes no colour curve); it changes only through the moving mask, erosion and fading.
  dict(name='Guard face',renderer='Ring',life=14,delay=4,billboard='Fixed',rotation=[0,0,0],
   ring=dict(vertices=96,outer=[R,0],inner=[.03,.08],center_ratio=.75,outer_color=[215,238,255,255],center_color=[80,150,255,185],inner_color=[45,105,235,45]),
   size=1,size_curve=[[0,.86],[22,1.05],[45,1],[100,1.03]],
   alpha_texture=tex('T_NoiseTile02'),alpha_scroll=[.03,-.05],cutoff=dict(start=.05,end=.9,easing='EaseInQuadratic'),
   edge=dict(color=[190,230,255,255],threshold=.05,scaling=1.5),fade_in=1,fade_out=5,emissive=1.2),
  # Two ripples spread across the face from the contact point.
  tilted_ring('Face ripple',blue,.62,life=10,delay=5,tilt=(0,0,0),thickness=.22) | dict(count=2,interval=3,position=list(CONTACT),emissive=1.3),
  # Exit: the face hands over to six sectors; the gap at the top sits under the contact point.
  *[_shard(i,c,o,d) for i,(c,o,d) in enumerate([(30,.72,.34),(90,.68,.42),(150,.74,.30),(210,.70,.38),(270,.73,.45),(330,.66,.32)])],
 ]
 contact=[
  flash('Contact glint',(240,248,255,255),1.2,life=4,delay=4,angle=15),
  glow('Contact bloom',(110,175,255,160),.7,life=8,delay=4),
  # Deflected glints thrown back toward the attacker and slightly up, not a symmetric spray.
  radial_sparks('Deflect sparks',6,(235,246,255,255),color_end=(90,160,255,255),life=(6,10),length=(.18,.32),width=.04,delay=4,fade_out=3)
   | spray([[.25,.75],[-.05,.45],[-.25,.35]],radius=.05),
  # Alpha-blended blue-grey chips spread over the plate at the break, dropping away.
  debris('Plate chips',7,[[.15,.9],[-.45,.15],[-.2,.45]],color=(125,160,210,255),size=(.05,.1),life=(12,16),gravity=.002,delay=13)
   | dict(spawn=dict(shape='Sphere',radius=[0,.4],rotate=False)),
 ]
 return effect('Yebisu_Guard','Yebisu Guard','hit','arcane',.5,[
  dict(name='Guard plane',renderer='None',life=max(lifetime(l) for l in plane),position=PLANE,rotation=[0,58,0],children=plane),
  # Unrotated pivot at the contact's world position (PLANE plus the yawed CONTACT), so spray boxes stay in world axes.
  dict(name='Contact point',renderer='None',life=max(lifetime(l) for l in contact),position=[.64,.2,.03],children=contact),
 ],attach='body',peak=.08,impact=.25,light=(.6,.8,1),delivery=SELF,
  design='A thin outline draws up a guard disc beside the defender, a short white star marks the blocked blow, the blue face ripples and erodes, then splits into six plate pieces and small chips that are gone by f30.')
