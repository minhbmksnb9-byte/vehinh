function shape_pyramid_trapezoid(){
  // ABCD trapezoid with AB || CD
  const A = Objects.createPoint(200,320,'A');
  const B = Objects.createPoint(420,320,'B');
  const C = Objects.createPoint(380,380,'C');
  const D = Objects.createPoint(240,380,'D');
  const S = Objects.createPoint(300,150,'S');
  Objects.createSegment(A,B); Objects.createSegment(B,C); Objects.createSegment(C,D); Objects.createSegment(D,A);
  Objects.createSegment(S,A); Objects.createSegment(S,B); Objects.createSegment(S,C); Objects.createSegment(S,D);
}
