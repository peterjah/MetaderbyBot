export enum raceClass {
  CLASS_5 = "Class V",
  CLASS_4 = "Class IV",
  CLASS_3 = "Class III",
  CLASS_2 = "Class II",
  CLASS_1 = "Class I",
}

export const raceFees = {
  [raceClass.CLASS_5]: 20,
  [raceClass.CLASS_4]: 30,
  [raceClass.CLASS_3]: 45,
  [raceClass.CLASS_2]: 65,
  [raceClass.CLASS_1]: 100,
};
