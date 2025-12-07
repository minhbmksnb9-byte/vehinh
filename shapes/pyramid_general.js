function shape_pyramid_general(){
  const A = Objects.createPoint(220,320,'A');
  const B = Objects.createPoint(340,320,'B');
  const C = Objects.createPoint(380,380,'C');
  const D = Objects.createPoint(200,380,'D');
  const S = Objects.createPoint(300,160,'S');
  Objects.createSegment(A,B); Objects.createSegment(B,C); Objects.createSegment(C,D); Objects.createSegment(D,A);
  Objects.createSegment(S,A); Objects.createSegment(S,B); Objects.createSegment(S,C); Objects.createSegment(S,D);
}
