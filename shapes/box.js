function shape_box(){
  // create a simple box in perspective: ABCD bottom, A'B'C'D' top
  const A = Objects.createPoint(200,300,'A');
  const B = Objects.createPoint(360,300,'B');
  const C = Objects.createPoint(380,380,'C');
  const D = Objects.createPoint(220,380,'D');
  const Ap = Objects.createPoint(200,180,"A'");
  const Bp = Objects.createPoint(360,180,"B'");
  const Cp = Objects.createPoint(380,260,"C'");
  const Dp = Objects.createPoint(220,260,"D'");

  Objects.createSegment(A,B); Objects.createSegment(B,C); Objects.createSegment(C,D); Objects.createSegment(D,A);
  Objects.createSegment(Ap,Bp); Objects.createSegment(Bp,Cp); Objects.createSegment(Cp,Dp); Objects.createSegment(Dp,Ap);
  Objects.createSegment(A,Ap); Objects.createSegment(B,Bp); Objects.createSegment(C,Cp); Objects.createSegment(D,Dp);
}
