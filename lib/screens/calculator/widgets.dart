import 'package:calculator/redux/actions/calculator.actions.dart';
import 'package:calculator/redux/reducers/app.state.dart';
import 'package:calculator/ui/constants.dart';
import 'package:flutter/material.dart';
import 'package:flutter_redux/flutter_redux.dart';

class NumberPad extends StatelessWidget {
  const NumberPad({
    Key? key,
    required this.sizeBox,
  }) : super(key: key);

  final double sizeBox;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      child: Column(
        mainAxisSize: MainAxisSize.max,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          RowBoxs(sizeBox: sizeBox,colors: firstLine,skip: 0,),
          for(var i=0;i<4;i++)
            RowBoxs(sizeBox: sizeBox,colors: lines,skip: i+1),
        ],
      ),
    );
  }
}

class BigBox extends StatelessWidget {
  const BigBox({
    Key? key,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return StoreConnector<AppState,AppState>(
      converter: (store)=> store.state,
      builder: (context, state){
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10,vertical: 6),
          child: Container(
            decoration: BoxDecoration(
              color: mainLightPurple,
              borderRadius: BorderRadius.circular(20)
            ),
            width: double.infinity,
            height: MediaQuery.of(context).size.height/4,
            child: Text(store.state.firstNumber,
              style: TextStyle(
                fontSize: 45
              ),
            ),
          ),
        );
      }
    );
  }
}

class RowBoxs extends StatelessWidget {
  const RowBoxs({
    Key? key,
    required this.sizeBox,
    required this.colors,
    required this.skip
  }) : super(key: key);
  final List<Color> colors;
  final double sizeBox;
  final int skip;

  @override
  Widget build(BuildContext context) {
    var i = -1;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: data.skip(skip*4).take(4)
        .map((symbol){
          i++;
          return NumberBox(sizeBox,symbol,colors[i]);
        }).toSet().toList()
    );
  }
}

class NumberBox extends StatelessWidget {
  final double sizeBox;
  final String numberBox;
  final Color color;
  // ignore: use_key_in_widget_constructors
  const NumberBox(
    this.sizeBox, this.numberBox, this.color,
  );
  @override
  Widget build(BuildContext context) {
    return StoreConnector<AppState, AppState>(
      converter: (store) => store.state,
      builder: (context, state){
        return InkWell(
          onTap: (){
            String text = store.state.firstNumber;
            text += numberBox;
            store.dispatch(SetFirstnumber(text));
            store.dispatch(NewNumber(text));
          },
          child: Container(
            width : sizeBox,
            height: sizeBox,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(20)
            ),
            child: Center(
              child: numberBox == ''
              ?const Icon(Icons.settings, color: Colors.white,size: 30,)
              :Text(
                numberBox,
                style: TextStyle(
                  fontSize: 28,
                  color: color == mainLightPurple
                  ?darkGrey
                  :Colors.white
                ),
              )
            ),
          ),
        );
      }
    );
  }
}