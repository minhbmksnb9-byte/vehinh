function shape_pyramid_triangle(){
  const A = Objects.createPoint(240,320,'A');
  const B = Objects.createPoint(360,320,'B');
  const C = Objects.createPoint(300,380,'C');
  const S = Objects.createPoint(300,160,'S');
  Objects.createSegment(A,B); Objects.createSegment(B,C); Objects.createSegment(C,A);
  Objects.createSegment(S,A); Objects.createSegment(S,B); Objects.createSegment(S,C);
}
