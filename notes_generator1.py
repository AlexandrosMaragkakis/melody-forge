import random
import os




# make random option for Minor families
# add pentatonics and exotic scales and blues
# IMPORTANT add music values
# make malodies based on chord progressions?
#bends
#vibrato
#tapping
#harmonics
#rests
#legato
#add gp5 support
#include rests, vibrato, bends, taps, harmomics, 
#option to specificate range of frets
#tab format option
# add option for a completely random option
# add option for notes outside the scale
# this needs to be in a loop obviously
# write a help message explaining options everytime
# need to write the nesessary checks
# option to leave an option blank

# important!
tone = 2
semitone = 1
prompt = ":> "
arrow = ' -> '

# TODO convert to dictionaries
notes_num = [0,1,2,3,4,5,6,7,8,9,10,11] 
notes_sym = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

#sonic-pi supports midi notes 
midi_notes = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71]

# Major modes intervals
ionian = [tone, tone, semitone, tone, tone, tone, semitone]
dorian = [tone, semitone, tone, tone, tone, semitone,tone]
phrygian = [semitone, tone, tone, tone, semitone, tone, tone]
lydian = [tone, tone, tone, semitone, tone, tone, semitone]
mixolydian = [tone, tone, semitone, tone, tone, semitone, tone]
aeolian = [tone, semitone, tone, tone, semitone, tone, tone]
locrian = [semitone, tone, tone, semitone, tone, tone, tone]

# Major modes 
major_modes_num = [0,1,2,3,4,5,6]
major_modes_sym = [ionian, dorian, phrygian, lydian, mixolydian, aeolian, locrian]
major_modes_str = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian']

# Harmonic minor modes intervals
harmonic_minor = [tone, semitone, tone, tone, semitone, tone+1, semitone]
locrian6 = [semitone, tone, tone, semitone, tone+1, semitone, tone]
ionian5 = [tone, tone, semitone, tone+1, semitone, tone, semitone]
dorian4 = [tone, semitone, tone+1, semitone, tone, semitone, tone]
phrygian_dominant = [semitone, tone+1, semitone, tone, semitone, tone, tone]
lydian2 = [tone+1, semitone, tone, semitone, tone, tone, semitone]
super_locrian = [semitone, tone, semitone, tone, tone, semitone, tone+1]

# Harmonic minor staff
harmonic_minor_modes_num = [0,1,2,3,4,5,6]
harmonic_minor_modes_sym = [harmonic_minor, locrian6, ionian5, dorian4, phrygian_dominant, lydian2, super_locrian]
harmonic_minor_modes_str = ['harmonic minor', 'locrian#6', 'ionian#5', 'dorian#4', 'phrygian dominant', 'lydian#2', 'super locrian']

# Melodic minor modes intervals
melodic_minor = [tone,semitone,tone,tone,tone,tone,semitone]
dorian_b2 = [semitone,tone,tone,tone,tone,semitone,tone]
lydian_augmented = [tone,tone,tone,tone,semitone,tone,semitone]
lydian_dominant = [tone,tone,tone,semitone,tone,semitone,tone]
mixolydian_b6 = [tone,tone,semitone,tone,semitone,tone, tone]
aeolian_b5 = [tone,semitone,tone,semitone,tone,tone,tone]
altered_scale = [semitone,tone,semitone,tone,tone,tone,tone]

# Melodic minor staff
melodic_minor_modes_num = [0,1,2,3,4,5,6]
melodic_minor_modes_sym = [melodic_minor, dorian_b2, lydian_augmented, lydian_dominant, mixolydian_b6, aeolian_b5, altered_scale]
melodic_minor_modes_str = ['melodic minor', 'dorian b2', 'lydian augmented', 'lydian dominant', 'mixolydian b6', 'aeolian b5', 'altered scale']

# Natural minor staff
natural_minor_modes_num = [0,1,2,3,4,5,6]
natural_minor_modes_sym = [aeolian, locrian, ionian, dorian, phrygian, lydian, mixolydian]
natural_minor_modes_str = ['aeolian', 'locrian', 'ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian']

# chords
chords = [
    'c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b',
    'cm', 'c#m', 'dm', 'd#m', 'em', 'fm', 'f#m', 'gm', 'g#m', 'am', 'a#m', 'bm',
    'c7', 'c#7', 'd7', 'd#7', 'e7', 'f7', 'f#7', 'g7', 'g#7', 'a7', 'a#7', 'b7',
    'cmin7', 'c#min7', 'dmin7', 'd#min7', 'emin7', 'fmin7', 'f#min7', 'gmin7', 'g#min7', 'amin7', 'a#min7', 'bmin7',
    'cmaj7', 'c#maj7', 'dmaj7', 'd#maj7', 'emaj7', 'fmaj7', 'f#maj7', 'gmaj7', 'g#maj7', 'amaj7', 'a#maj7', 'bmaj7',
]

major_chords = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
minor_chords = ['cm', 'c#m', 'dm', 'd#m', 'em', 'fm', 'f#m', 'gm', 'g#m', 'am', 'a#m', 'bm']
dominant_7th_chords = ['c7', 'c#7', 'd7', 'd#7', 'e7', 'f7', 'f#7', 'g7', 'g#7', 'a7', 'a#7', 'b7']
minor7_chords = ['cmin7', 'c#min7', 'dmin7', 'd#min7', 'emin7', 'fmin7', 'f#min7', 'gmin7', 'g#min7', 'amin7', 'a#min7', 'bmin7']
major7_chords = ['cmaj7', 'c#maj7', 'dmaj7', 'd#maj7', 'emaj7', 'fmaj7', 'f#maj7', 'gmaj7', 'g#maj7', 'amaj7', 'a#maj7', 'bmaj7']


# function to create a pool of the available notes for the melody
def pool(key, path, minor, mode):
    if 'major' in path:
        if 'ionian' in mode:
            mode = ionian
        elif 'dorian' in mode:
            mode = dorian
        elif 'phrygian' in mode:
            mode = phrygian
        elif 'lydian' in mode:
            mode = lydian
        elif 'mixolydian' in mode:
            mode = mixolydian
        elif 'aeolian' in mode:
            mode = aeolian
        else:
            mode = locrian
    else:
        if minor == 'harmonic':
            if 'harmonic minor' in mode:
                mode = harmonic_minor
            elif 'locrian#6' in mode:
                mode = locrian6
            elif 'ionian#5' in mode:
                mode = ionian5
            elif 'dorian#4' in mode:
                mode = dorian4
            elif 'phrygian dominant' in mode:
                mode = phrygian_dominant
            elif 'lydian#2' in mode:
                mode = lydian2
            else:
                mode = super_locrian

        elif minor == 'melodic':
            if 'melodic minor' in mode:
                mode = melodic_minor
            elif 'dorian b2' in mode:
                mode = dorian_b2
            elif 'lydian augmented' in mode:
                mode = lydian_augmented
            elif 'lydian dominant' in mode:
                mode = lydian_dominant
            elif 'mixolydian b6' in mode:
                mode = mixolydian_b6
            elif 'aeolian b5' in mode:
                mode = aeolian_b5
            else:
                mode = altered_scale

        else:
            if 'aeolian' in mode:
                mode = aeolian
            elif 'locrian' in mode:
                mode = locrian
            elif 'ionian' in mode:
                mode = ionian
            elif 'dorian' in mode:
                mode = dorian
            elif 'phrygian' in mode:
                mode = phrygian
            elif 'lydian' in mode:
                mode = lydian
            else:
                mode = mixolydian

    # we fill -notes- with the notes of the chosen mode
    notes_num2 = []
    # index = position of note in notes_num
    index = notes_sym.index(key)
    for i in range(7):
        if (index + mode[i]) < 12:
            notes_num2.append(notes_num[index])
        elif (index + mode[i]) == 12:
            notes_num2.append(notes_num[index])
            index = 0
            continue
        elif (index + mode[i]) == 13:
            notes_num2.append(notes_num[index])
            index = 1
            continue
        elif (index + mode[i]) == 14:
            notes_num2.append(notes_num[index])
            index = 2
            continue
        index = index+mode[i]
    
    
    return notes_num2

# choosing random notes from pool
def random_melody(notes,num,key):
    final = []
    for i in range(num):
        n1 = random.randint(0,6)
        final.append(notes_sym[notes[n1]])
    del final[-1]
    final.append(key)
    final[0] = key
    
    return final

# saving the file
def savefile(final):
    # extract notes to .txt
    # for sonic-pi use
    
    header = "Do you want to save the notes in a txt file?"
    ans = check_yes_no(header)
    if ans == True:
        filename = input("Enter new file name <name>, we'll add the .txt at the end) : ")
        with open(filename, "wt") as f:
            f.write("# %s\n" % final)
            
        print("%s saved succesfully!" % filename)
        
        
    else:
        print("Program termination.")
        

# what to display
def show(count,key,path,minor,mode):
    os.system('clear')
    
    count = count + 1
    if count == 1:
        print(key+arrow)
    elif count == 2:
        print(key+arrow+path.capitalize())
    elif count == 3:
        if path == 'minor':
            print(key+arrow+path.capitalize()+arrow+minor.capitalize())
        else:
            print(key+arrow+path.capitalize()+arrow+mode.capitalize())
    else:
        print(key+arrow+path.capitalize()+arrow+minor.capitalize()+arrow+mode.capitalize())
    
    return count
        
# user_input 
def user_input():

    count = 0
    # key
    while True:

        os.system('clear')
        key = input("Choose key\n%s: " % notes_sym)
        key = key.upper()
        if key == "RANDOM":
            n = random.randint(0,11)
            key = notes_sym[n]
            print(key)
            string = "Continue with " + key + " as a key?"
            p = check_yes_no(string)
            if p is True:
                break
            else:
                continue

        elif key in notes_sym:
            break
        

    count = show(count,key,path=' ',minor=' ',mode= ' ')

    # path
    while True:
        count = show(count,key,path=' ',minor=' ',mode= ' ') - 1
        path = input("Choose your path\nMinor/Major: ")
        path = path.lower()
        if path == "random":
            n = random.randint(0,1)
            if n == 0:
                path = "minor"
            else:
                path = "major"
            print(path.capitalize())
            string = "Continue with " + path + " scales?"
            p = check_yes_no(string)
            if p is True:
                break
            else:
                continue
        elif path == "minor" or path == "major":
            break
        else:
            print("Wrong input!")

    count = show(count,key,path,minor=' ',mode=' ')

    # minor path
    minor = " "
    if path == "minor":
        while True:
            minor = input("Choose a minor scale\nHarmonic/Melodic/Natural : ")
            minor = minor.lower()
            if minor == 'harmonic' or minor == 'melodic' or minor == 'natural':
                break
            elif minor == 'random':
                n = random.randint(1,3)
                if n == 1:
                    minor = 'harmonic'
                elif n == 2:
                    minor = 'melodic'
                else:
                    minor = 'natural'
                
                print(minor)
                string = 'Continue with ' + minor + ' minor?'
                p = check_yes_no(string)
                if p is True:
                    break
                else:
                    continue

            else:
                print("Invalid input!")

    if minor != ' ':
        count = show(count,key,path,minor,mode= ' ')

    # mode
    while True:
        if path == 'minor':
            count = show(count,key,path,minor,mode= ' ') - 1
        else:
            count = show(count,key,path,minor=' ',mode=' ') - 1

        mode = input("Choose mode : ")
        mode = mode.lower()
        if minor == " ":
            if mode == "random":
                n = random.randint(0,6)
                mode = major_modes_str[n]
                print(mode.capitalize())
                string = 'Continue with ' + mode + ' mode?'
                p = check_yes_no(string)
                if p is True:
                    break
                else:
                    continue

            elif mode in major_modes_str:
                break
            else:
                print("Invalid input!")
                continue
        else:
            if minor == 'harmonic':
                if mode == 'random':
                    n = random.randint(0,6)
                    mode = harmonic_minor_modes_str[n]
                    print(mode.capitalize())
                    string = 'Continue with ' + mode + ' mode?'
                    p = check_yes_no(string)
                    if p is True:
                        break
                    else:
                        continue

                elif mode in harmonic_minor_modes_str:
                    break
                else:
                    print("Invalid input!")
                    continue

            elif minor == 'melodic':
                if mode == 'random':
                    n = random.randint(0,6)
                    mode = melodic_minor_modes_str[n]
                    print(mode.capitalize())
                    string = 'Continue with ' + mode + ' mode?'
                    p = check_yes_no(string)
                    if p is True:
                        break
                    else:
                        continue

                elif mode in melodic_minor_modes_str:
                    break
                else:
                    print("Invalid input!")

            elif minor == 'natural':
                if mode == 'random':
                    n = random.randint(0,6)
                    mode = natural_minor_modes_str[n]
                    print(mode.capitalize())
                    string = 'Continue with ' + mode + ' mode?'
                    p = check_yes_no(string)
                    if p is True:
                        break
                    else:
                        continue
                elif mode in natural_minor_modes_str:
                    break
                else:
                    print("Invalid input!")
            else:
                print("Invalid input!")

    count = show(count,key,path,minor,mode)

    # number of notes
    while True:
        num = input("Number of notes : ")
        num = num.lower()
        if num == "random":
            num = random.randint(4,32)
            print(num)
            break
        elif num.isdigit() == False:
            print('Invalid input')
        else:
            num = int(num)
            if num < 4 or num > 32:
                print("You can ask for 4-32 notes")
            else:
                break

        
    return key,path,minor,mode,num

def check_yes_no(string):

    while True:
        answer = input("%s\n[y/n]: " % string)
        answer = answer.lower()
        if answer != 'yes' and answer != 'y' and answer != 'no' and answer != 'n':
            print('Please enter y or n')
            continue
        elif 'yes' in answer or answer == 'y':
            return True
        elif 'no' in answer or answer == 'n':
            return False

# random all
def random_all():

    n = random.randint(0,11)
    key = notes_sym[n]

    n = random.randint(0,1)
    if n == 0:
        path = "minor"

        n = random.randint(1,3)
        if n == 1:
            minor = 'harmonic'
            n = random.randint(0,6)
            mode = harmonic_minor_modes_str[n]
        elif n == 2:
            minor = 'melodic'
            n = random.randint(0,6)
            mode = melodic_minor_modes_str[n]
        else:
            minor = 'natural'
            n = random.randint(0,6)
            mode = natural_minor_modes_str[n]

    else:
        path = "major" 
        minor = ' '
        n = random.randint(0,6)
        mode = major_modes_str[n]

    # number of notes
    num = 8 # random.randint(4,32)
    if path != 'minor':
        print(key+arrow+path.capitalize()+arrow+mode.capitalize())
    else:
        print(key+arrow+path.capitalize()+arrow+minor.capitalize()+arrow+mode.capitalize())
    

    return key,path,minor,mode,num
    

def list_options(options: list):
    str = ''
    str += "\nAvailable options:\n"
    for opt in options:
        str += '\n'
        str += '['
        str += '{0}'.format(options.index(opt) + 1) 
        str += ']'
        str += opt
    return str
    

        

        
##################################################################################################################################


def main():
    os.system('clear')

    header = "\u0332".join("Note Generator\n")
    options = ["Simple Melody", "Melody over Chord Progression"]
    choices = "\n[1] {0} \n[2] {1}".format(options[0], options[1])
    accepted = [1,2]
    while True:
        print(header,list_options(options))
        option = int(input("\nEnter number of option[] " + prompt))
        if option in accepted:
            break
        else:
            os.system('clear')

    if option == 1:
        os.system('clear')
        print("\u0332".join(options[0]))
        header = '\nDo you want a completely random melody?'
        p = check_yes_no(header)
        if p is True:
            key, path, minor, mode, num = random_all()
        else:
            key, path, minor, mode, num = user_input()

        notes = pool(key,path,minor,mode)
        final = random_melody(notes,num,key)
        print(final)
        savefile(final)
    elif option == 2:
        os.system('clear')
        while True:
            print("\u0332".join(options[1]))
            chord_progression = input("\nEnter chord progression: ")
            chord_progression = chord_progression.lower()
            chord_progression = chord_progression.split()
            flag = True
            for i in chord_progression:
                if i not in chords:
                    os.system('clear')
                    print('Invalid input!\n')
                    #os.system('clear')
                    flag = False
                    break
            if flag == False:
                continue
            else:
                break
        combined = []
        for i in chord_progression:
            if i in major_chords:
                n = random.randint(1,2)
                if n == 1:
                    mode = 'ionian'
                else:
                    mode = 'lydian'
                notes = pool(i[0].upper(),'major',' ',mode)
                while True:
                    num = input("Number of notes for %s: " % i)
                    num = num.lower()
                    if num == "random":
                        num = random.randint(4,32)
                        print(num)
                        break
                    elif num.isdigit() == False:
                        print('Invalid input')
                    else:
                        num = int(num)
                        if num < 4 or num > 32:
                            print("You can ask for 4-32 notes")
                        else:
                            break
                final = random_melody(notes,num,i[0])
                combined.append(final)
                #print(final)
            elif i in minor_chords:
                pass
            elif i in dominant_7th_chords:
                pass
            elif i in major7_chords:
                pass
            elif i in minor7_chords:
                pass
        print(combined)
            

main()



    








