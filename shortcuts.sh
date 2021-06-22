## Constants ##

AMPHTML_PATH=~/projects/amphtml
SWGJS_PATH=~/projects/swgjs


## Methods ##

function swgjs_add_shortcuts_to_bashrc() {
  local SHORTCUTS_CMD="source $SWGJS_PATH/shortcuts.sh"

  # Add to .bashrc
  if grep -Fxq "$SHORTCUTS_CMD" ~/.bashrc
  then
      echo "Swgjs Shortcuts are already installed. ✅"
  else
      echo "Swgjs Shortcuts are installing..."
      echo "# Swgjs Shortcuts" >> ~/.bashrc
      echo "$SHORTCUTS_CMD" >> ~/.bashrc
      echo "" >> ~/.bashrc
      echo "Swgjs Shortcuts are now installed. ✅"
  fi
}


function swgjs_get_github_username() {
  # Check for GitHub env var
  if [[ -z "${GITHUB_USERNAME}" ]]; then
    # Ask for username
    echo "What is your GitHub username?"
    read GITHUB_USERNAME

    # Optionally save username to .bashrc
    echo "Save GitHub username ($GITHUB_USERNAME) to your .bashrc? [Y|n]"
    read RESPONSE

    if [ "$RESPONSE" == "n" ]; then
      return 0
    fi

    # Save username
    echo "# GitHub" >> ~/.bashrc
    echo "export GITHUB_USERNAME=$GITHUB_USERNAME" >> ~/.bashrc
    echo "" >> ~/.bashrc

    echo "Saved!"
  else
    return 0
  fi
}


function swgjs_has_nodejs() {
  # Checks whether Nodejs is installed.
  # Swgjs and AMP depend on Nodejs.
  if ! command -v npx &> /dev/null
  then
      echo "You need Nodejs to continue."
      echo "  For Linux and Mac, install NVM."
      echo "  For Windows, install Nodejs."
      return 1
  fi
  return 0
}


function swgjs_create_branch() {
  BRANCH_NAME=$1
  if [[ -z "$BRANCH_NAME" ]]; then
    echo "What is the branch named?"
    read BRANCH_NAME
  fi

  cd $SWGJS_PATH
  git fetch team main
  git checkout team/main
  git branch -D $BRANCH_NAME
  git switch -c $BRANCH_NAME
  git push -f me $BRANCH_NAME
}


function swgjs_create_amp_branch() {
  BRANCH_NAME=$1
  if [[ -z "$BRANCH_NAME" ]]; then
    echo "What is the branch named?"
    read BRANCH_NAME
  fi

  cd $AMPHTML_PATH
  git fetch team main
  git checkout team/main
  git branch -D $BRANCH_NAME
  git switch -c $BRANCH_NAME
  git push -f me $BRANCH_NAME
}


function swgjs_install() {
  swgjs_get_github_username

  if ! test -f "$SWGJS_PATH/package.json"
  then
      echo "Installing Swgjs"
      mkdir -p $SWGJS_PATH
      git clone -o team https://github.com/subscriptions-project/swg-js $SWGJS_PATH
      cd $SWGJS_PATH
      git remote add me git@github.com:$GITHUB_USERNAME/swg-js.git
      npx yarn
  fi
}


function swgjs_install_amp() {
  swgjs_get_github_username

  if ! test -f "$AMPHTML_PATH/package.json"
  then
      echo "Installing AMP"
      mkdir -p $AMPHTML_PATH
      git clone -o team https://github.com/ampproject/amphtml $AMPHTML_PATH
      cd $AMPHTML_PATH
      git remote add me git@github.com:$GITHUB_USERNAME/amphtml.git
  fi
}


function swgjs_create_amp_release_pr() {
  if ! swgjs_has_nodejs; then return; fi

  echo "Swgjs: Create AMP Release PR"
  echo ""

  swgjs_get_github_username

  echo "What SwG Version are you releasing? (ex: 0.1.22.333)"
  read SWG_VERSION

  swgjs_install
  swgjs_install_amp

  # Build Swgjs for AMP.
  cd $SWGJS_PATH
  git fetch team
  git checkout team/main
  npx gulp export-to-amp --swgVersion=$SWG_VERSION

  # Create new AMP branch.
  BRANCH_NAME="swg-release--$SWG_VERSION"
  swgjs_create_amp_branch $BRANCH_NAME

  # Copy exports to AMP.
  cp $SWGJS_PATH/dist/amp/* $AMPHTML_PATH/third_party/subscriptions-project/

  # Push AMP branch.
  git add .
  git commit -m "SwG Release $SWG_VERSION"
  git push -f -u me $BRANCH_NAME

  # Wrap up.
  echo "You're all set! Now just create a PR:"
  echo "https://github.com/ampproject/amphtml/compare/main...$GITHUB_USERNAME:$BRANCH_NAME?expand=1"
}


function swgjs_start_server() {
  SWG_JS=~/projects/swgjs
  cd $SWG_JS
  npx gulp
}
